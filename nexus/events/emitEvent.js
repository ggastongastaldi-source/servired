// Nexus Universal Emitter v1.3 — Shadow Mode / Fire-and-Forget
// NUNCA usar con await. Nunca bloquea el request lifecycle.
const crypto   = require('crypto');
const mongoose = require('mongoose');

function emitEvent({ entityType, type, aggregateId, payload = {} }) {
  if (!entityType || !type || !aggregateId) {
    console.warn('[Nexus] ⚠️ Evento omitido — faltan campos obligatorios');
    return;
  }

  const event = {
    eventId:    crypto.randomUUID(),
    version:    1,
    entityType: String(entityType).toLowerCase(),
    type:       String(type).toUpperCase(),
    aggregateId:String(aggregateId),
    payload,
    timestamp:  new Date(),
    metadata: {
      environment: process.env.NODE_ENV || 'production',
      source:      'servired-legacy',
      nodeVersion: process.version,
      pid:         process.pid
    }
  };

  mongoose.connection.collection('events').insertOne(event)
    .then(() => console.log(`[Nexus] 📡 [${event.entityType}] ${event.type} → ${event.aggregateId}`))
    .catch(err => console.error(`[Nexus-Shadow-Error] [${entityType}:${type}]:`, err.message));
}

module.exports = { emitEvent };
