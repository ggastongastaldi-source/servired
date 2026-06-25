'use strict';
const busAdapter = require('../../services/sinapsisBusAdapter');
async function inject(opts) {
  const { type, actorId, zoneId, payload, runId, scenario, seed } = opts;
  const event = {
    type, actorId,
    zoneId: zoneId || 'la_matanza',
    payload,
    _meta: { source: 'chaosLab', scenario, runId, seed: seed ?? null },
  };
  return await busAdapter.publish(event);
}
module.exports = { inject };
