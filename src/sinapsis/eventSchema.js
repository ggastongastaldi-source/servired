// SINAPSIS Event Schema Registry v1.0
const { v4: uuidv4 } = require('uuid');

const EVENT_TYPES = {
  // ServiRed domain
  'servired.order.created':      { version: '1.0', domain: 'servired' },
  'servired.order.accepted':     { version: '1.0', domain: 'servired' },
  'servired.order.in_progress':  { version: '1.0', domain: 'servired' },
  'servired.order.completed':    { version: '1.0', domain: 'servired' },
  'servired.order.paid':         { version: '1.0', domain: 'servired' },
  'servired.order.cancelled':    { version: '1.0', domain: 'servired' },
  // Grove Parts domain (preparado)
  'grove.product.searched':      { version: '1.0', domain: 'grove' },
  'grove.order.created':         { version: '1.0', domain: 'grove' },
  'grove.stock.updated':         { version: '1.0', domain: 'grove' },
  // System domain
  'sinapsis.health.check':       { version: '1.0', domain: 'system' },
  'sinapsis.drift.detected':     { version: '1.0', domain: 'system' },
  'sinapsis.watchdog.triggered': { version: '1.0', domain: 'system' },
};

function createEvent(type, payload = {}, metadata = {}) {
  const schema = EVENT_TYPES[type];
  if (!schema) throw new Error(`[SINAPSIS] Tipo de evento desconocido: ${type}`);

  return {
    eventId:          uuidv4(),
    eventVersion:     schema.version,
    eventTypeVersion: metadata.eventTypeVersion || '1.0',
    correlationId:    metadata.correlationId || uuidv4(),
    timestamp:        new Date().toISOString(),
    type,
    domain:           schema.domain,
    payload,
    metadata: {
      source: metadata.source || 'unknown',
      node:   metadata.node   || 'termux',
      ...metadata
    },
    origin: {
      node:    metadata.node    || 'termux',
      version: metadata.version || '1.0'
    },
    status: 'PENDING'
  };
}

function validateEvent(event) {
  const required = ['eventId','type','timestamp','payload','status'];
  const missing = required.filter(f => !event[f]);
  if (missing.length) throw new Error(`[SINAPSIS] Campos faltantes: ${missing.join(', ')}`);
  if (!EVENT_TYPES[event.type]) throw new Error(`[SINAPSIS] Tipo no registrado: ${event.type}`);
  return true;
}

module.exports = { createEvent, validateEvent, EVENT_TYPES };
