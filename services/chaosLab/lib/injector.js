'use strict';
const { adapter } = require('../../../shared/events/router-instance');
const { randomUUID } = require('crypto');

async function inject(opts) {
  const { type, actorId, zoneId, payload, runId, scenario, seed } = opts;

  const envelope = {
    event_id:       randomUUID(),
    event_type:     type,
    correlation_id: runId,
    causation:      null,
    actor:          { id: actorId, role: 'chaosLab' },
    context:        { zoneId: zoneId || 'la_matanza' },
    payload,
    metadata:       { source: 'chaosLab', scenario, runId, seed: seed ?? null },
  };

  return await adapter.persist(envelope);
}

module.exports = { inject };
