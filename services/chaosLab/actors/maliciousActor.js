'use strict';
const { inject } = require('../lib/injector');
const { BASELINE_PRICE_ARS } = require('./honestActor');
const CRASH_RATIO = 0.20;
const IDENTITY_ROTATE_N = 5;
function poissonInterval(rng, l) { return Math.round(-Math.log(rng() + 1e-10) / l * 1000); }
async function emit({ rng, metrics, runId, scenario, count = 20, lambdaPerSec = 5 }) {
  let identityIndex = 0;
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % IDENTITY_ROTATE_N === 0) identityIndex++;
    const actorId = `chaosLab::A2::id${identityIndex}::${runId}`;
    const crashPrice = Math.round(BASELINE_PRICE_ARS * CRASH_RATIO);
    const event = await inject({ type: 'PRICE_SUBMITTED', actorId, zoneId: 'la_matanza', payload: { price: crashPrice, rubro: 'construccion_seca', index: i, _attack: 'flash_crash' }, runId, scenario, seed: null });
    metrics.recordEvent({ isChaos: true });
    metrics.recordPrice({ baseline: BASELINE_PRICE_ARS, effective: crashPrice });
    if (event?.eventId) metrics.recordInjection(event.eventId);
    await new Promise(r => setTimeout(r, poissonInterval(rng, lambdaPerSec)));
  }
}
module.exports = { emit };
