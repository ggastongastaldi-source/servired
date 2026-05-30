const mongoose = require('mongoose');
const { evaluate } = require('../policies/engine');

const handlers = {
  LeadDiscovered: require('./handlers/LeadDiscovered'),
  LeadEnriched:   require('./handlers/LeadEnriched'),
  LeadScored:     require('./handlers/LeadScored'),
  LeadConverted:  require('./handlers/LeadConverted'),
  LeadQualified:  require('../policies/handlers/LeadQualified'),
  LeadRejected:   require('../policies/handlers/LeadRejected'),
  LeadEscalated:  require('../policies/handlers/LeadEscalated'),
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

    // 1. Proyección
    const handler = handlers[event.eventType];
    if (handler) {
      try {
        await handler(event, mongoose);
        console.log(`[PROJECTION] ${event.eventType} | ${event.aggregateId} ✅`);
      } catch (err) {
        console.error(`[PROJECTION] Error en ${event.eventType}:`, err.message);
      }
    }

    // 2. PDL — evalúa políticas y emite eventos de decisión
    // Los eventos emitidos por PDL también disparan el Change Stream
    try {
      await evaluate(event);
    } catch (err) {
      console.error(`[PDL] Error evaluando ${event.eventType}:`, err.message);
    }
  });

  stream.on('error', (err) => {
    console.error('[PROJECTION] Stream error:', err.message);
  });
}

module.exports = { startProjectionEngine };
