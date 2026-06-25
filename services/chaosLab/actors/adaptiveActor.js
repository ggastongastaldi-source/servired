'use strict';
const { inject } = require('../lib/injector');
const { BASELINE_PRICE_ARS } = require('./honestActor');
const PHASES = { PROBE: { crashRatio: 0.75, lambdaPerSec: 1 }, MODERATE: { crashRatio: 0.50, lambdaPerSec: 3 }, AGGRESSIVE: { crashRatio: 0.20, lambdaPerSec: 8 } };
const DETECTION_THRESHOLD = 0.35;
const SAFE_THRESHOLD = 0.70;
function poissonInterval(rng, l) { return Math.round(-Math.log(rng() + 1e-10) / l * 1000); }
async function emit({ rng, metrics, runId, scenario, rounds = 4, eventsPerRound = 8 }) {
  let phaseKey = 'PROBE', identityIndex = 0;
  for (let round = 0; round < rounds; round++) {
    const phase = PHASES[phaseKey];
    const actorId = `chaosLab::A3::id${identityIndex}::${runId}`;
    console.log(`[A3] Round ${round+1} | Fase: ${phaseKey}`);
    for (let i = 0; i < eventsPerRound; i++) {
      const crashPrice = Math.round(BASELINE_PRICE_ARS * phase.crashRatio);
      const event = await inject({ type: 'PRICE_SUBMITTED', actorId, zoneId: 'la_matanza', payload: { price: crashPrice, rubro: 'construccion_seca', index: round*eventsPerRound+i, _attack: `adaptive_${phaseKey.toLowerCase()}` }, runId, scenario, seed: null });
      metrics.recordEvent({ isChaos: true });
      metrics.recordPrice({ baseline: BASELINE_PRICE_ARS, effective: crashPrice });
      if (event?.event?.event_id) metrics.recordInjection(event.event.event_id);
      await new Promise(r => setTimeout(r, poissonInterval(rng, phase.lambdaPerSec)));
    }
    const lastScore = metrics._trustSamples.length ? metrics._trustSamples[metrics._trustSamples.length-1].score : 1.0;
    const trustEstimate = Math.max(0, lastScore - 0.15 * (round + 1));
    metrics.recordTrustSample(trustEstimate);
    const phases = ['PROBE','MODERATE','AGGRESSIVE'];
    if (trustEstimate < DETECTION_THRESHOLD) { phaseKey = 'PROBE'; identityIndex++; console.log(`[A3] Detectado. Rotando id${identityIndex}.`); }
    else if (trustEstimate > SAFE_THRESHOLD && phaseKey !== 'AGGRESSIVE') { phaseKey = phases[Math.min(phases.indexOf(phaseKey)+1, 2)]; console.log(`[A3] Escalando a ${phaseKey}.`); }
  }
}
module.exports = { emit };
