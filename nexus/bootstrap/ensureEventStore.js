// Nexus EventStore Bootstrap v1.0
// Se ejecuta UNA sola vez en startup. Nunca en hot-path.
const mongoose = require('mongoose');

async function ensureEventStore() {
  try {
    const col = mongoose.connection.collection('events');
    await col.createIndexes([
      { key: { eventId: 1 },                        name: 'uid_eventId',          unique: true },
      { key: { aggregateId: 1, timestamp: 1 },       name: 'idx_aggregate_timeline'             },
      { key: { entityType: 1, type: 1, timestamp:-1},name: 'idx_routing_analytics'              }
    ]);
    console.log('[Nexus] 🛡️ EventStore listo — índices OK (events)');
  } catch(err) {
    console.error('[Nexus-Bootstrap] Error crítico:', err.message);
    throw err;
  }
}

module.exports = { ensureEventStore };
