'use strict';
const A1 = require('../actors/honestActor');
const A2 = require('../actors/maliciousActor');
async function run({ rng, metrics, runId }) {
  console.log('[SpamBurst] A1 + A2 burst masivo...');
  await Promise.all([
    A1.emit({ rng, metrics, runId, scenario: 'spamBurst', count: 10, intervalMs: 500 }),
    A2.emit({ rng, metrics, runId, scenario: 'spamBurst', count: 50, lambdaPerSec: 15 }),
  ]);
  console.log('[SpamBurst] Completado.');
}
module.exports = { run };
