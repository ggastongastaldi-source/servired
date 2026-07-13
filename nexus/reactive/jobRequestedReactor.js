/**
 * jobRequestedReactor v2 — Etapa 3 Strangler Fig
 *
 * Escucha DOS tipos de evento:
 *   - 'JOB_REQUESTED' (legacy routes/jobs.js) → payload ya tiene track/zona/rubro
 *   - 'JobCreated'    (dominio canónico)       → normalizar campos antes de dispatch
 *
 * DISPATCH track → DispatchService.dispatchPedido()
 * AUCTION  track → no hace nada (quoteService maneja su propio flujo)
 */
"use strict";

const { classifyJob } = require('../../services/jobClassifier');
const { analyze }     = require('../../services/marketField/marketFieldEngine');

let _io = null;

function init(io) {
  _io = io;
}

async function jobRequestedReactor(event) {
  try {
    // ── Normalización: soporta ambos formatos ──────────────────────────
    let payload;

    if (event.type === 'JOB_REQUESTED') {
      // Legacy: payload completo con track ya calculado
      payload = event.payload || {};

    } else if (event.type === 'JobCreated') {
      // Dominio canónico: normalizar y clasificar
      const p = event.payload || {};
      const classification = classifyJob({
        rubro:            p.rubro,
        urgency:          p.urgency,
        estimatedValue:   p.estimatedValue,
        clientWantsQuotes: p.clientWantsQuotes,
      });

      let pricingMultiplier = 1.0;
      let marketPressure    = 'NORMAL';
      try {
        const mkt = await analyze({ zoneId: p.zona, rubro: p.rubro, jobLocation: p.ubicacion });
        pricingMultiplier = mkt.pricingMultiplier ?? 1.0;
        marketPressure    = mkt.marketPressure    ?? 'NORMAL';
      } catch (e) {
        console.warn('[jobRequestedReactor] marketField no disponible, usando defaults:', e.message);
      }

      payload = {
        clientId:          p.clientId,
        rubro:             p.rubro,
        zona:              p.zona,
        urgency:           p.urgency     || 'MEDIUM',
        estimatedValue:    p.estimatedValue || 0,
        descripcion:       p.descripcion || '',
        ubicacion:         p.ubicacion,
        track:             classification.track,
        classifyReason:    classification.reason,
        pricingMultiplier,
        marketPressure,
        sourceEventId:     event.eventId,
        sourceType:        'JobCreated',
      };

    } else {
      return; // evento no relevante
    }

    // ── Guard: solo DISPATCH track ─────────────────────────────────────
    const { track, zona, rubro, clientId, descripcion, ubicacion,
            estimatedValue, pricingMultiplier } = payload;

    if (track !== 'DISPATCH') return;

    if (!zona || !rubro) {
      console.warn('[jobRequestedReactor] payload incompleto, skip', event.eventId);
      return;
    }

    if (!_io) {
      console.error('[jobRequestedReactor] io no inicializado — llamar init(io) en server.js');
      return;
    }

    // ── DTO compatible con DispatchService.dispatchPedido(io, pedido) ──
    const pedido = {
      _id:               event.eventId,
      tipoServicio:      rubro,
      zona,
      urgency:           payload.urgency || 'MEDIUM',
      descripcion:       descripcion || '',
      ubicacion,
      estimatedValue:    estimatedValue || 0,
      pricingMultiplier: pricingMultiplier || 1.0,
      clientId,
      sourceEventId:     event.eventId,
    };

    const { dispatchPedido } = require('../../src/dispatch/services/DispatchService');

    console.log(`[jobRequestedReactor] DISPATCH → zona:${zona} rubro:${rubro} src:${event.type}`);
    const result = await dispatchPedido(_io, pedido);

    if (result?.success) {
      console.log(`[jobRequestedReactor] ✅ JOB_ASSIGNED offerId:${result.offerId} workers:${result.workersNotified}`);
    } else {
      console.warn(`[jobRequestedReactor] ⚠️  sin workers: ${result?.reason}`);
    }

  } catch (err) {
    console.error('[jobRequestedReactor] error:', err.message);
  }
}

module.exports = { jobRequestedReactor, init };
