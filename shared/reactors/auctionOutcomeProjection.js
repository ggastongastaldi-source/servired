/**
 * AuctionOutcomeProjection — Reactor CQRS
 *
 * Escucha: QUOTE_SELECTED
 * Produce: documento en auction_outcomes (read model para Aladdín)
 *
 * Lógica:
 * 1. Lee todas las quotes activas del mismo requestId
 * 2. Marca la seleccionada como selected: true
 * 3. Las demás quedan como selected: false (estado derivado = "rejected")
 * 4. Calcula estadísticas de la subasta
 * 5. Persiste el documento atómico de AuctionOutcome
 * 6. Actualiza status "rejected" en el modelo Quote para las no seleccionadas
 *
 * Idempotencia: upsert por requestId con $setOnInsert guard en version.
 * Si QUOTE_SELECTED se procesa dos veces, el segundo upsert no cambia datos.
 *
 * Patrón: igual que trustDecayReactor (subscribe + batch + emit opcional)
 */
"use strict";

const Quote = require("../../models/Quote");
const AuctionOutcome = require("../../models/AuctionOutcome");

let _router = null;
let _buffer = [];
let _timer  = null;
let _active = false;

const BATCH_INTERVAL_MS = 1000;

function init(router) {
  if (_active) return;
  _router = router;
  _active = true;

  router.subscribe("QUOTE_SELECTED", _onQuoteSelected);

  _timer = setInterval(_processBatch, BATCH_INTERVAL_MS);
  if (_timer.unref) _timer.unref();

  console.log("[AuctionOutcomeProjection] Activo.");
}

function _onQuoteSelected(persisted) {
  if (!persisted) return;
  _buffer.push({ persisted, receivedAt: Date.now() });
}

async function _processBatch() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0, _buffer.length);

  for (const { persisted } of batch) {
    try {
      await _handleQuoteSelected(persisted);
    } catch (err) {
      console.error("[AuctionOutcomeProjection] Error procesando QUOTE_SELECTED:", err.message);
    }
  }
}

async function _handleQuoteSelected(persisted) {
  const ev      = persisted.event;
  const payload = ev.payload;

  const { quoteId, requestId, clienteId, prestadorId, precio, rubroId, zonaId } = payload;

  // 1. Leer todas las quotes del mismo request (en cualquier estado activo)
  const todasLasQuotes = await Quote.find({
    requestId,
    status: { $in: ["sent", "selected", "created"] },
  }).lean();

  if (todasLasQuotes.length === 0) {
    console.warn(`[AuctionOutcomeProjection] No hay quotes para requestId: ${requestId}`);
    return;
  }

  // 2. Construir snapshot de la competencia
  const precios = todasLasQuotes.map((q) => q.precio).filter(Boolean);
  const precioMinimo   = Math.min(...precios);
  const precioMaximo   = Math.max(...precios);
  const precioPromedio = precios.reduce((a, b) => a + b, 0) / precios.length;

  const preciosOrdenados = [...precios].sort((a, b) => a - b);
  const posicionPrecioGanador = preciosOrdenados.indexOf(precio) + 1;

  const cotizaciones = todasLasQuotes.map((q) => ({
    quoteId:           q.quoteId,
    prestadorId:       q.prestadorId,
    precio:            q.precio,
    moneda:            q.moneda || "ARS",
    rubroId:           q.rubroId,
    zonaId:            q.zonaId,
    enviadaEn:         q.enviadaEn,
    tiempoRespuestaMs: null, // se puede calcular cuando exista REQUEST_CREATED en el bus
    selected:          q.quoteId === quoteId,
  }));

  // 3. Persistir AuctionOutcome (idempotente por requestId)
  await AuctionOutcome.findOneAndUpdate(
    { requestId },
    {
      $setOnInsert: { requestId },
      $set: {
        clienteId,
        rubroId:              rubroId || null,
        zonaId:               zonaId  || null,
        cotizaciones,
        totalParticipantes:   cotizaciones.length,
        quoteSeleccionadaId:  quoteId,
        precioGanador:        precio,
        prestadorGanadorId:   prestadorId,
        precioMinimo:         Number(precioMinimo.toFixed(2)),
        precioMaximo:         Number(precioMaximo.toFixed(2)),
        precioPromedio:       Number(precioPromedio.toFixed(2)),
        posicionPrecioGanador,
        eventoSeleccionId:    ev.event_id,
        resueltaEn:           new Date(ev.timestamp),
        version:              1,
      },
    },
    { upsert: true }
  );

  // 4. Marcar quotes no seleccionadas como "rejected" en el modelo Quote
  //    (estado derivado — no hay evento QUOTE_REJECTED en el bus)
  const quoteIdsRechazadas = todasLasQuotes
    .filter((q) => q.quoteId !== quoteId && q.status !== "selected")
    .map((q) => q.quoteId);

  if (quoteIdsRechazadas.length > 0) {
    await Quote.updateMany(
      { quoteId: { $in: quoteIdsRechazadas } },
      {
        $set: {
          status:      "rejected",
          rechazadaEn: new Date(ev.timestamp),
          ultimoEventoId:   ev.event_id,
          ultimoEventoTipo: "QUOTE_SELECTED", // causalidad explícita
        },
        $inc: { version: 1 },
      }
    );
  }

  console.log(
    `[AuctionOutcome] requestId:${requestId} | ganadora:${quoteId} | precio:${precio} ARS | participantes:${cotizaciones.length} | rechazadas:${quoteIdsRechazadas.length}`
  );
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _active = false;
}

module.exports = { init, stop };
