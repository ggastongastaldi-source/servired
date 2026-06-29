/**
 * jobRequestedReactor — escucha JOB_REQUESTED y enruta al engine correcto
 *
 * DISPATCH track → DispatchService.dispatchPedido()  → emite JOB_ASSIGNED
 * AUCTION  track → no hace nada (quoteService maneja su propio flujo)
 *
 * Se conecta al changeStreamObserver existente, mismo patrón que
 * procesarMarketFieldEvent y merchantProjectionReactor.
 */
"use strict";

let _io = null;

function init(io) {
  _io = io;
}

async function jobRequestedReactor(event) {
  try {
    if (event.type !== 'JOB_REQUESTED') return;

    const { track, clientId, rubro, zona, urgency, descripcion, ubicacion,
            estimatedValue, pricingMultiplier } = event.payload || {};

    if (track !== 'DISPATCH') return; // AUCTION se maneja solo

    if (!zona || !rubro) {
      console.warn('[jobRequestedReactor] payload incompleto, skip', event.eventId);
      return;
    }

    // Construir pedido compatible con DispatchService.dispatchPedido(io, pedido)
    const pedido = {
      _id:          event.eventId,   // eventId como correlación — no crea doc Mongo
      tipoServicio: rubro,
      zona,
      urgency:      urgency || 'MEDIUM',
      descripcion:  descripcion || '',
      ubicacion,
      estimatedValue: estimatedValue || 0,
      pricingMultiplier: pricingMultiplier || 1.0,
      clientId,
      sourceEventId: event.eventId,
    };

    const { dispatchPedido } = require('../../src/dispatch/services/DispatchService');

    const io = _io;
    if (!io) {
      console.error('[jobRequestedReactor] io no inicializado — llamar init(io) en server.js');
      return;
    }

    console.log(`[jobRequestedReactor] DISPATCH → zona:${zona} rubro:${rubro}`);
    const result = await dispatchPedido(io, pedido);

    if (result?.success) {
      console.log(`[jobRequestedReactor] JOB_ASSIGNED emitido offerId:${result.offerId}`);
    } else {
      console.warn(`[jobRequestedReactor] dispatch sin workers: ${result?.reason}`);
    }

  } catch (err) {
    console.error('[jobRequestedReactor] error:', err.message);
  }
}

module.exports = { jobRequestedReactor, init };
