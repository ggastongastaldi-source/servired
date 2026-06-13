// Singleton del EventRouter para el proceso de servidor.
// Fase de observacion (Sprint 3.3): persistencia en memoria (sin Mongo,
// sin hash-chaining nuevo - eso queda para Sprint 3.1/4 - BusLogManager).
//
// Listener WILDCARD: log estructurado de cada evento publicado, para
// observar volumen/correlaciones/causation/payloads en logs de Render.

const { EventRouter, WILDCARD } = require('./eventRouter');
const { createInMemoryAdapter } = require('./persistenceAdapters/inMemoryAdapter');

const adapter = createInMemoryAdapter({ maxEntries: 500 });
const router = new EventRouter({ persistenceAdapter: adapter });

router.subscribe(WILDCARD, function (persisted) {
  const e = persisted.event;
  console.log(JSON.stringify({
    level: 'info',
    source: 'EventBus',
    event_type: e.event_type,
    event_id: e.event_id,
    correlation_id: e.correlation_id,
    causation_event_type: e.causation.event_type,
    actor_role: e.actor.role,
    context_zone: e.context.zone,
    sequence: persisted.persistence.sequence
  }));
});

module.exports = { router, adapter };
