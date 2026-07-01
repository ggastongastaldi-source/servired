# AUDITORÍA FASE IV-F — Insumos SOC Bloque 3 (Comercial + Aladdín)
Generado: Wed Jul  1 06:54:32 -03 2026

## Modelo MerchantProjection (schema completo)
/**
 * MerchantProjection — Read Model persistido
 * Nunca se escribe directamente desde controllers.
 * Solo el MerchantProjectionReactor puede escribir aquí.
 * El dashboard lee únicamente este documento.
 */
const mongoose = require('mongoose');

const MerchantProjectionSchema = new mongoose.Schema({
  // Identidad
  merchantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true, unique: true, index: true },
  usuarioId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nombreComercial: String,
  estado:          String,
  verificado:      Boolean,
  logo:            String,
  zonaId:          String,
  rubroId:         String,

  // ── Sub-proyección: Dashboard ────────────────────────────────────────────
  dashboard: {
    vistasHoy:           { type: Number, default: 0 },
    vistasUltimos7dias:  { type: Number, default: 0 },
    vistasUltimos30dias: { type: Number, default: 0 },
    solicitudesHoy:      { type: Number, default: 0 },
    pedidosConcretados:  { type: Number, default: 0 },
    calificacionPromedio:{ type: Number, default: 0 },
    ingresosEstimadoMes: { type: Number, default: 0 },
    boostActivos:        { type: Number, default: 0 }
  },

  // ── Sub-proyección: Catálogo ─────────────────────────────────────────────
  catalogo: {
    totalItems:    { type: Number, default: 0 },
    enPromocion:   { type: Number, default: 0 },
    sinStock:      { type: Number, default: 0 },
    topProductos:  { type: Array,  default: [] }  // [{ id, nombre, vistas, precio }]
  },

  // ── Sub-proyección: Analytics ────────────────────────────────────────────
  analytics: {
    conversionRate:           { type: Number, default: 0 },
    vistasUltimos7diasSerie:  { type: Array,  default: [] }, // [{ fecha, cantidad }]
    solicitudesUltimos7diasSerie: { type: Array, default: [] }
  },

  // ── Sub-proyección: Campañas ─────────────────────────────────────────────
  campanias: {
    activas:         { type: Number, default: 0 },
    vistasGeneradas: { type: Number, default: 0 },
    conversionRate:  { type: Number, default: 0 }
  },

  // ── Control de reconstrucción ────────────────────────────────────────────
  ultimoEventoProcesado: { type: String, default: null },  // hash del último evento
  version:               { type: Number, default: 0 },     // para optimistic locking
  reconstruidaEn:        { type: Date,   default: Date.now },
  actualizadaEn:         { type: Date,   default: Date.now }
}, {
  collection: 'merchant_projections',
  timestamps: { createdAt: 'reconstruidaEn', updatedAt: 'actualizadaEn' }
});

MerchantProjectionSchema.index({ zonaId: 1 });
MerchantProjectionSchema.index({ rubroId: 1 });

module.exports = mongoose.model('MerchantProjection', MerchantProjectionSchema);

## services/merchantProjection.js (cómo se consulta)
/**
 * merchantProjection v2.0
 * 
 * Lee únicamente desde MerchantProjection (read model persistido).
 * Si no existe la projection, la reconstruye on-demand y la persiste.
 * 
 * Garantía: el dashboard nunca recalcula desde eventos — solo lee.
 */
const MerchantProjection        = require('../models/MerchantProjection');
const BusinessProfile           = require('../models/BusinessProfile');
const { reconstruirProjection } = require('./merchantProjectionReactor');

async function projectMerchantState(usuarioId) {
  // 1. Buscar read model persistido
  const profile = await BusinessProfile.findOne({ usuarioId }).lean();
  if (!profile) return null;

  let proj = await MerchantProjection.findOne({ merchantId: profile._id }).lean();

  // 2. Si no existe o es muy antigua (>15 min), reconstruir
  const STALE_MS = 15 * 60 * 1000;
  const esAntigua = proj && (Date.now() - new Date(proj.actualizadaEn).getTime() > STALE_MS);

  if (!proj || esAntigua) {
    await reconstruirProjection(profile._id, usuarioId, null);
    proj = await MerchantProjection.findOne({ merchantId: profile._id }).lean();
  }

  if (!proj) return null;

  // 3. Mapear al contrato público del dashboard
  return {
    merchantId:      proj.merchantId,
    nombreComercial: proj.nombreComercial,
    estado:          proj.estado,
    verificado:      proj.verificado,
    logo:            proj.logo,
    zonaId:          proj.zonaId,

    actividad: {
      vistasHoy:           proj.dashboard.vistasHoy,
      solicitudesHoy:      proj.dashboard.solicitudesHoy,
      pedidosConcretados:  proj.dashboard.pedidosConcretados,
      calificacion:        proj.dashboard.calificacionPromedio
    },

    catalogo: {
      totalItems:   proj.catalogo.totalItems,
      enPromocion:  proj.catalogo.enPromocion,
      sinStock:     proj.catalogo.sinStock,
      topProductos: proj.catalogo.topProductos
    },

    campanias: {
      activas:        proj.campanias.activas,
      vistasGeneradas:proj.campanias.vistasGeneradas,
      conversionRate: proj.campanias.conversionRate
    },

    ingresos: {
      estimadoMes: proj.dashboard.ingresosEstimadoMes,
      moneda: 'ARS'
    },

    tendencia: {
      vistasUltimos7dias:      proj.analytics.vistasUltimos7diasSerie,
      solicitudesUltimos7dias: proj.analytics.solicitudesUltimos7diasSerie
    },

    proyectadoEn: proj.actualizadaEn
  };
}

module.exports = { projectMerchantState };

## aladdinIntelligenceReactor.js — qué expone / qué estado guarda
"use strict";
/**
 * AladdinIntelligenceReactor — Reactor CQRS (ADR-003: read-only)
 *
 * Escucha: AuctionOutcomeProjected (evento derivado, emitido recien
 *          cuando AuctionOutcome ya esta materializado — elimina la
 *          dependencia de orden entre reactores suscriptos a QUOTE_SELECTED)
 * Lee:     AuctionOutcome (read model YA calculado — no recalcula stats)
 * Produce: aladdin_insights + evento AladdinInsightGenerated, publicado
 *          via el mismo EventRouter (pasa por validateEvent y fan-out).
 *
 * ADR-003: nunca escribe en Quote, AuctionOutcome ni MarketField.
 * Los insights son advisory, no autoritativos.
 * Patrón: igual que auctionOutcomeProjection.js.
 */

const AuctionOutcome = require("../../models/AuctionOutcome");
const AladdinInsight = require("../../models/AladdinInsight");
const crypto = require("crypto");

// Idempotencia: insightId determinístico (no UUID random) para que
// un replay/retry del mismo evento no duplique el insight.
function _deriveInsightId(requestId, insightType) {
  return crypto.createHash("sha256").update(`${requestId}:${insightType}`).digest("hex");
}

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
  router.subscribe("AuctionOutcomeProjected", _onAuctionOutcomeProjected);
  _timer = setInterval(_processBatch, BATCH_INTERVAL_MS);
  if (_timer.unref) _timer.unref();
  console.log("[AladdinIntelligenceReactor] Activo.");
}

function _onAuctionOutcomeProjected(persisted) {
  if (!persisted) return;
  _buffer.push({ persisted, receivedAt: Date.now() });
}

async function _processBatch() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0, _buffer.length);
  for (const { persisted } of batch) {
    try { await _handleAuctionOutcomeProjected(persisted); }
    catch (err) { console.error("[AladdinIntelligenceReactor] Error:", err.message); }
  }
}

async function _handleAuctionOutcomeProjected(persisted) {
  const ev = persisted.event;
  const { requestId } = ev.payload;

  const outcome = await AuctionOutcome.findOne({ requestId }).lean();
  if (!outcome) {
    // Defensa en profundidad: no deberia pasar, AuctionOutcomeProjected
    // solo se emite despues de materializar el read model.
    console.warn(`[AladdinIntelligenceReactor] AuctionOutcome no encontrado para requestId:${requestId} (inesperado)`);
    return;
  }

  for (const regla of RULES) {
    const parcial = regla(outcome);
    if (!parcial) continue;

    const insightId = _deriveInsightId(outcome.requestId, parcial.insightType);
    const generatedAt = new Date();

    try {
      await AladdinInsight.create({
        insightId, insightType: parcial.insightType,
        zonaId: outcome.zonaId || null, rubroId: outcome.rubroId || null,
        requestId: outcome.requestId, confidence: parcial.confidence,
        message: parcial.message,
        sourceEventIds: [outcome.eventoSeleccionId, ev.event_id].filter(Boolean),
        status: "active", generatedAt, version: 1,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Ya existe: reprocesamiento idempotente (replay/retry). No re-emitir al bus.
        continue;
      }
      throw err;
    }

    await _router.publish({
      event_id: crypto.randomUUID(),
      event_type: "AladdinInsightGenerated",
      timestamp: new Date().toISOString(),
      correlation_id: ev.correlation_id || ev.event_id,
      causation: { event_id: ev.event_id, event_type: ev.event_type },
      actor: { user_id: null, role: "system:aladdin-intelligence" },
      context: ev.context || { tenant_id: "servired", session_id: null, zone: outcome.zonaId || null, source: "aladdin-intelligence" },
      payload: { insightId, insightType: parcial.insightType, confidence: parcial.confidence, requestId: outcome.requestId },
      metadata: { version: 1, environment: process.env.NODE_ENV || "production" },
    }).catch(e => console.error("[AladdinIntelligenceReactor] Error publicando en router:", e.message));

    console.log(`[AladdinIntelligenceReactor] Insight: ${parcial.insightType} (${(parcial.confidence * 100).toFixed(0)}%) requestId:${outcome.requestId}`);
  }
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _active = false;
}

module.exports = { init, stop };

## ¿Existe algún endpoint GET ya armado para merchants/aladdin en admin.js?

## routes/merchantRoutes.js — endpoints existentes
7:router.get('/health', mc.health);
10:router.get ('/profile', auth, mc.getProfile);
11:router.post ('/profile', auth, mc.createProfile);
15:router.get('/dashboard', auth, mc.getDashboard);
18:router.get   ('/catalog',           auth, mc.listCatalog);
19:router.post  ('/catalog',           auth, mc.createItem);
24:router.get('/analytics', auth, mc.getAnalytics);
27:router.post('/admin/reconstruct', auth, async (req, res) => {
