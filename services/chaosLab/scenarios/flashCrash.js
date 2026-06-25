'use strict';
const A1 = require('../actors/honestActor');
const A2 = require('../actors/maliciousActor');
async function run({ rng, metrics, runId }) {
  console.log('[FlashCrash] A1 + A2 concurrentes...');
  await Promise.all([
    A1.emit({ rng, metrics, runId, scenario: 'flashCrash', count: 15, intervalMs: 300 }),
    A2.emit({ rng, metrics, runId, scenario: 'flashCrash', count: 30, lambdaPerSec: 6 }),
  ]);
  console.log('[FlashCrash] Completado.');
}
module.exports = { run };
