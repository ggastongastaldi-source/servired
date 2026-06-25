'use strict';
const { inject } = require('../lib/injector');
const BASELINE_PRICE_ARS = 15000;
const PRICE_STDDEV_RATIO = 0.12;
function normalPrice(rng, base, sd) {
  const u1 = rng(), u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return Math.round(base * (1 + sd * z));
}
async function emit({ rng, metrics, runId, scenario, count = 10, intervalMs = 200 }) {
  const actorId = `chaosLab::A1::${runId}`;
  for (let i = 0; i < count; i++) {
    const price = normalPrice(rng, BASELINE_PRICE_ARS, PRICE_STDDEV_RATIO);
    const event = await inject({ type: 'PRICE_SUBMITTED', actorId, zoneId: 'la_matanza', payload: { price, rubro: 'construccion_seca', index: i }, runId, scenario, seed: null });
    metrics.recordEvent({ isChaos: false });
    metrics.recordPrice({ baseline: price, effective: price });
    if (event?.eventId) metrics.recordInjection(event.eventId);
    await new Promise(r => setTimeout(r, intervalMs));
  }
}
module.exports = { emit, BASELINE_PRICE_ARS };
