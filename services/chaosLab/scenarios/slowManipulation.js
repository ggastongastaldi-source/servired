'use strict';
const A1 = require('../actors/honestActor');
const A3 = require('../actors/adaptiveActor');
async function run({ rng, metrics, runId }) {
  console.log('[SlowManipulation] A1 + A3 adaptativo...');
  await Promise.all([
    A1.emit({ rng, metrics, runId, scenario: 'slowManipulation', count: 20, intervalMs: 400 }),
    A3.emit({ rng, metrics, runId, scenario: 'slowManipulation', rounds: 4, eventsPerRound: 8 }),
  ]);
  console.log('[SlowManipulation] Completado.');
}
module.exports = { run };
