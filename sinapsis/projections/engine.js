const mongoose = require('mongoose');

const handlers = {
  LeadDiscovered: require('./handlers/LeadDiscovered'),
  LeadEnriched:   require('./handlers/LeadEnriched'),
  LeadScored:     require('./handlers/LeadScored'),
  LeadConverted:  require('./handlers/LeadConverted'),
};

async function startProjectionEngine() {
  const db = mongoose.connection.useDb('sinapsis');
  const col = db.collection('events');

  const stream = await col.watch(
    [{ $match: { operationType: 'insert' } }],
    { fullDocument: 'updateLookup' }
  );

  console.log('[SINAPSIS] Projection Engine activo — escuchando sinapsis.events');

  stream.on('change', async (change) => {
    const event = change.fullDocument;
    const handler = handlers[event.eventType];
    if (!handler) return;
    try {
      await handler(event, mongoose);
      console.log(`[PROJECTION] ${event.eventType} | ${event.aggregateId} ✅`);
    } catch (err) {
      console.error(`[PROJECTION] Error en ${event.eventType}:`, err.message);
    }
  });

  stream.on('error', (err) => {
    console.error('[PROJECTION] Stream error:', err.message);
  });
}

module.exports = { startProjectionEngine };
