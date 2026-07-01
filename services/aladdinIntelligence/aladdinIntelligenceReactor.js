"use strict";
/**
 * AladdinIntelligenceReactor — Reactor CQRS (ADR-003: read-only)
 *
 * Escucha: QUOTE_SELECTED (mismo evento que auctionOutcomeProjection)
 * Lee:     AuctionOutcome (read model YA calculado — no recalcula stats)
 * Produce: aladdin_insights + evento AladdinInsightGenerated en
 *          sinapsis_bus_log vía sinapsisBusAdapter (mismo hash-chain).
 *
 * ADR-003: nunca escribe en Quote, AuctionOutcome ni MarketField.
 * Los insights son advisory, no autoritativos.
 * Patrón: igual que auctionOutcomeProjection.js.
 */

const AuctionOutcome = require("../../models/AuctionOutcome");
const AladdinInsight = require("./models/AladdinInsight");
const { createSinapsisBusAdapter } = require("../../shared/events/persistenceAdapters/sinapsisBusAdapter");
const crypto = require("crypto");

const busAdapter = createSinapsisBusAdapter();

let _router = null;
let _buffer = [];
let _timer  = null;
let _active = false;

const BATCH_INTERVAL_MS = 2000;

// ── Reglas — funciones puras, agregar nuevas acá. Ninguna toca estado. ──
const RULES = [
  function reglaPrecioGanadorMuyPorDebajoDelPromedio(outcome) {
    if (!outcome.precioPromedio || outcome.totalParticipantes < 2) return null;
    const desvio = (outcome.precioPromedio - outcome.precioGanador) / outcome.precioPromedio;
    if (desvio >= 0.15) {
      return {
        insightType: "PRICE_ANOMALY_LOW",
        confidence: Math.min(0.5 + desvio, 0.95),
        message: `Precio ganador ${(desvio * 100).toFixed(1)}% por debajo del promedio en zona ${outcome.zonaId || "?"} (rubro ${outcome.rubroId || "?"})`,
      };
    }
    return null;
  },
  function reglaSubastaConPocaCompetencia(outcome) {
    if (outcome.totalParticipantes === 1) {
      return {
        insightType: "LOW_COMPETITION_ZONE",
        confidence: 0.6,
        message: `Solo 1 prestador cotizo en zona ${outcome.zonaId || "?"} — posible oferta insuficiente`,
      };
    }
    return null;
  },
];

function init(router) {
  if (_active) return;
  _router = router;
  _active = true;
  router.subscribe("QUOTE_SELECTED", _onQuoteSelected);
  _timer = setInterval(_processBatch, BATCH_INTERVAL_MS);
  if (_timer.unref) _timer.unref();
  console.log("[AladdinIntelligenceReactor] Activo.");
}

function _onQuoteSelected(persisted) {
  if (!persisted) return;
  _buffer.push({ persisted, receivedAt: Date.now() });
}

async function _processBatch() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0, _buffer.length);
  for (const { persisted } of batch) {
    try { await _handleQuoteSelected(persisted); }
    catch (err) { console.error("[AladdinIntelligenceReactor] Error:", err.message); }
  }
}

async function _handleQuoteSelected(persisted) {
  const ev = persisted.event;
  const { requestId } = ev.payload;

  const outcome = await AuctionOutcome.findOne({ requestId }).lean();
  if (!outcome) {
    console.warn(`[AladdinIntelligenceReactor] AuctionOutcome aun no disponible para requestId:${requestId}`);
    return;
  }

  for (const regla of RULES) {
    const parcial = regla(outcome);
    if (!parcial) continue;

    const insightId = crypto.randomUUID();
    const generatedAt = new Date();

    await AladdinInsight.findOneAndUpdate(
      { insightId },
      { $setOnInsert: {
          insightId, insightType: parcial.insightType,
          zonaId: outcome.zonaId || null, rubroId: outcome.rubroId || null,
          requestId: outcome.requestId, confidence: parcial.confidence,
          message: parcial.message,
          sourceEventIds: [outcome.eventoSeleccionId, ev.event_id].filter(Boolean),
          status: "active", generatedAt, version: 1,
      }},
      { upsert: true }
    );

    await busAdapter.persist({
      event_id: crypto.randomUUID(),
      event_type: "AladdinInsightGenerated",
      correlation_id: ev.correlation_id || ev.event_id,
      causation: { event_id: ev.event_id, event_type: ev.event_type },
      actor: { user_id: null, role: "system:aladdin-intelligence" },
      context: ev.context || { tenant_id: "servired", session_id: null, zone: outcome.zonaId || null, source: "aladdin-intelligence" },
      payload: { insightId, insightType: parcial.insightType, confidence: parcial.confidence, requestId: outcome.requestId },
      metadata: { version: 1, environment: process.env.NODE_ENV || "production" },
    }).catch(e => console.error("[AladdinIntelligenceReactor] Error persistiendo en bus:", e.message));

    console.log(`[AladdinIntelligenceReactor] Insight: ${parcial.insightType} (${(parcial.confidence * 100).toFixed(0)}%) requestId:${outcome.requestId}`);
  }
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _active = false;
}

module.exports = { init, stop };
