// Emitters del flujo de Referidos (QR -> Landing -> Registro -> Atribucion).
// Mismo patron que shell-events.js: wrappers delgados sobre createEvent(),
// usando EVENT_TYPES ya existentes en el catalogo congelado de Sprint 1.

const { createEvent } = require('./createEvent');
const { EVENT_TYPES } = require('./event-types');

function emitQrScanned(params) {
  const p = params || {};
  return createEvent({
    type: EVENT_TYPES.QR_SCANNED,
    actor: p.actor,
    context: p.context,
    correlationId: p.correlationId,
    causation: p.causation,
    payload: p.payload || {}
  });
}

function emitRegisterCompleted(params) {
  const p = params || {};
  return createEvent({
    type: EVENT_TYPES.REGISTER_COMPLETED,
    actor: p.actor,
    context: p.context,
    correlationId: p.correlationId,
    causation: p.causation,
    payload: p.payload || {}
  });
}

function emitLeadAttributed(params) {
  const p = params || {};
  return createEvent({
    type: EVENT_TYPES.LEAD_ATTRIBUTED,
    actor: p.actor,
    context: p.context,
    correlationId: p.correlationId,
    causation: p.causation,
    payload: p.payload || {}
  });
}

module.exports = { emitQrScanned, emitRegisterCompleted, emitLeadAttributed };
