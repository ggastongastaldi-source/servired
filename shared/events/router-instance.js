'use strict';
const { EventRouter } = require('./eventRouter');
const { createSinapsisBusAdapter } = require('./persistenceAdapters/sinapsisBusAdapter');
const priceAnomalyObserver = require('../observers/priceAnomalyObserver');
const trustDecayReactor    = require('../reactors/trustDecayReactor');
const auctionOutcomeProjection = require('../reactors/auctionOutcomeProjection');
const aladdinIntelligenceReactor = require('../reactors/aladdinIntelligenceReactor');

const adapter = createSinapsisBusAdapter();
const router  = new EventRouter({ persistenceAdapter: adapter });

// Logger original — intacto
router.subscribe('*', function (persisted) {
  if (!persisted) return;
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

// Reactor Layer V1
priceAnomalyObserver.init(router);

// Reactor Layer V2 — TrustDecay
trustDecayReactor.init(router);

// Reactor Layer V3 — AuctionOutcome (CQRS)
auctionOutcomeProjection.init(router);

// Reactor Layer V4 — Aladdin Intelligence (ADR-001/003: read-only sobre estado territorial)
aladdinIntelligenceReactor.init(router);

module.exports = { router, adapter, trustDecayReactor, auctionOutcomeProjection, aladdinIntelligenceReactor };
