'use strict';
const { router } = require('../../../shared/events/router-instance');
const { createEvent } = require('../../../shared/events/createEvent');

async function inject(opts) {
  const { type, actorId, zoneId, payload, runId, scenario, seed } = opts;

  const event = createEvent({
    type,
    actor:   { user_id: actorId, role: 'chaosLab' },
    context: { zone: zoneId || 'la_matanza', source: 'chaosLab' },
    payload: { ...payload, _meta: { source: 'chaosLab', scenario, runId, seed: seed ?? null } },
    correlationId: runId,
  });

  return await router.publish(event);
}

module.exports = { inject };
