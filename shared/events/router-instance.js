const { EventRouter } = require('./EventRouter');
const { createSinapsisBusAdapter } = require('./persistenceAdapters/sinapsisBusAdapter');
const { WILDCARD } = require('./event-types');

const adapter = createSinapsisBusAdapter();
const router  = new EventRouter({ persistenceAdapter: adapter });

router.subscribe(WILDCARD, function (persisted) {
  if (!persisted) return; // evento duplicado idempotente → skip
  const e = persisted.event;
  console.log(JSON.stringify({
    level:      'info',
    source:     'EventBus',
    event_type: e.event_type,
    event_id:   e.event_id,
    correlation_id: e.correlation_id,
    causation_event_type: e.causation && e.causation.event_type,
    actor_role:   e.actor  && e.actor.role,
    context_zone: e.context && e.context.zone,
    sequence:   persisted.persistence.sequence,
    hash_tip:   persisted.persistence.entryHash
      ? persisted.persistence.entryHash.slice(0, 12) + '...'
      : null
  }));
});

module.exports = { router, adapter };
