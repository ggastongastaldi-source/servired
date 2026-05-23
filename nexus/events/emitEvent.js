// Nexus Universal Emitter v2.0 — con Dixie Gate interceptor
// Fire-and-forget. NUNCA usar con await.
const crypto   = require('crypto');
const mongoose = require('mongoose');

const DIXIE_MODE = process.env.DIXIE_MODE || 'observe';

function emitEvent({ entityType, type, aggregateId, payload = {} }) {
  if (!entityType || !type || !aggregateId) {
    console.warn('[Nexus] ⚠️ Evento omitido — faltan campos obligatorios');
    return;
  }

  const event = {
    eventId:     crypto.randomUUID(),
    version:     1,
    entityType:  String(entityType).toLowerCase(),
    type:        String(type).toUpperCase(),
    aggregateId: String(aggregateId),
    payload,
    timestamp:   new Date(),
    metadata: {
      environment: process.env.NODE_ENV || 'production',
      source:      'servired-legacy',
      nodeVersion: process.version,
      pid:         process.pid
    }
  };

  // Dixie Gate interceptor — async, nunca bloquea el emit
  _dixieIntercept(event).catch(() => {});

  // Persistencia fire-and-forget
  mongoose.connection.collection('events').insertOne(event)
    .then(() => console.log(`[Nexus] 📡 [${event.entityType}] ${event.type} → ${event.aggregateId}`))
    .catch(err => console.error(`[Nexus-Shadow-Error] [${entityType}:${type}]:`, err.message));
}

async function _dixieIntercept(event) {
  try {
    const { validate, getAggregateState, audit } = require('../dixie/gate');
    const state  = await getAggregateState(event.aggregateId);
    const result = validate(state, event);

    // En enforce: bloquear eventos inválidos (futuro)
    // En observe: solo auditar
    if (result.issues.length > 0) {
      await audit(event, state, result);
      if (DIXIE_MODE === 'enforce' && !result.allowed) {
        throw new Error(`[DixieGate] Evento bloqueado: ${event.type}`);
      }
    }
  } catch(e) {
    // Dixie Gate nunca rompe el flujo principal en observe
    if (DIXIE_MODE !== 'enforce') {
      console.error('[DixieGate] Error en intercept (ignorado):', e.message);
    } else {
      throw e;
    }
  }
}

module.exports = { emitEvent };
