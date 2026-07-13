'use strict';

/**
 * Tests de persistencia — en memoria (sin MongoDB real).
 * Valida el comportamiento de los stores con stubs en memoria.
 * Los tests de integración contra MongoDB real van en tests/integration/.
 */

const { TrustProfile }        = require('../../src/domain/aggregates/TrustProfile');
const { RiskCase }            = require('../../src/domain/aggregates/RiskCase');
const { ActorType }           = require('../../src/domain/valueObjects/ActorType');
const { RiskLevel }           = require('../../src/domain/valueObjects/RiskLevel');
const { FixedClock }          = require('../../src/infrastructure/clock/FixedClock');
const { ConcurrencyError }    = require('../../src/domain/errors');
const { UnitOfWork }          = require('../../src/infrastructure/bus/UnitOfWork');

const clock  = new FixedClock(new Date('2025-01-01T00:00:00.000Z'));
const POLICY = {
  version: 'policy-v1.0.0',
  dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  minimumConfidenceForQuarantine: 0.3,
  assessmentTtlMs: 300_000,
};

// ── InMemoryEventStore para tests unitarios ──────────────────────────────────
class InMemoryEventStore {
  constructor() { this._streams = new Map(); }

  async append(aggregateId, events, expectedVersion) {
    const stream  = this._streams.get(aggregateId) || [];
    if (stream.length !== expectedVersion) {
      throw new ConcurrencyError(aggregateId, expectedVersion, stream.length);
    }
    this._streams.set(aggregateId, [...stream, ...events]);
  }

  async getStream(aggregateId, fromVersion = 0) {
    const stream = this._streams.get(aggregateId) || [];
    return stream.slice(fromVersion);
  }

  async countEvents(aggregateId) {
    return (this._streams.get(aggregateId) || []).length;
  }

  async getByTypes(types, fromDate) {
    const all = [];
    for (const stream of this._streams.values()) {
      for (const e of stream) {
        if (types.includes(e.type)) all.push(e);
      }
    }
    return all;
  }
}

// ── InMemory Profile Repository ───────────────────────────────────────────────
class InMemoryProfileRepository {
  constructor(eventStore) {
    this._store = eventStore;
    this._index = new Map();
  }
  async findById(id) {
    const events = await this._store.getStream(id);
    if (!events.length) return null;
    return TrustProfile.rehydrate(events);
  }
  async findByActorId(actorId) {
    const id = this._index.get(actorId);
    return id ? this.findById(id) : null;
  }
  async save(profile) {
    const events = profile.pullDomainEvents();
    if (!events.length) return;
    await this._store.append(profile.id, events, profile.expectedVersion);
    if (events.some(e => e.type === 'TrustProfileCreated')) {
      this._index.set(profile.actorId, profile.id);
    }
  }
}

// ── InMemory RiskCase Repository ──────────────────────────────────────────────
class InMemoryRiskCaseRepository {
  constructor(eventStore) { this._store = eventStore; this._index = new Map(); }
  async findById(id) {
    const events = await this._store.getStream(id);
    if (!events.length) return null;
    return RiskCase.rehydrate(events);
  }
  async findOpenByProfileId(trustProfileId) {
    const ids = this._index.get(trustProfileId) || [];
    const cases = await Promise.all(ids.map(id => this.findById(id)));
    return cases.filter(rc => rc && rc.isOpen);
  }
  async save(rc) {
    const events = rc.pullDomainEvents();
    if (!events.length) return;
    await this._store.append(rc.id, events, rc.expectedVersion);
    const list = this._index.get(rc.trustProfileId) || [];
    if (!list.includes(rc.id)) {
      this._index.set(rc.trustProfileId, [...list, rc.id]);
    }
  }
}

// ── InMemory Publisher ────────────────────────────────────────────────────────
class InMemoryPublisher {
  constructor() { this.published = []; }
  async publish(events) { this.published.push(...events); }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InMemoryEventStore — append y replay', () => {
  let store;
  beforeEach(() => { store = new InMemoryEventStore(); });

  test('append y getStream retornan mismos eventos', async () => {
    const events = [{ type: 'TrustProfileCreated', aggregateId: 'tp_1' }];
    await store.append('tp_1', events, 0);
    const stream = await store.getStream('tp_1');
    expect(stream).toHaveLength(1);
    expect(stream[0].type).toBe('TrustProfileCreated');
  });

  test('optimistic locking: lanza ConcurrencyError', async () => {
    await store.append('tp_1', [{ type: 'A' }], 0);
    await expect(store.append('tp_1', [{ type: 'B' }], 0))
      .rejects.toThrow(ConcurrencyError);
  });

  test('append consecutivo con versión correcta', async () => {
    await store.append('tp_1', [{ type: 'A' }], 0);
    await store.append('tp_1', [{ type: 'B' }], 1);
    const stream = await store.getStream('tp_1');
    expect(stream).toHaveLength(2);
  });

  test('getStream desde versión N', async () => {
    await store.append('tp_1', [{ type: 'A' },{ type: 'B' }], 0);
    const stream = await store.getStream('tp_1', 1);
    expect(stream).toHaveLength(1);
    expect(stream[0].type).toBe('B');
  });

  test('streams independientes por aggregateId', async () => {
    await store.append('tp_1', [{ type: 'A' }], 0);
    await store.append('tp_2', [{ type: 'B' }], 0);
    expect(await store.countEvents('tp_1')).toBe(1);
    expect(await store.countEvents('tp_2')).toBe(1);
  });
});

describe('InMemoryProfileRepository — save y findByActorId', () => {
  let store, repo;
  beforeEach(() => {
    store = new InMemoryEventStore();
    repo  = new InMemoryProfileRepository(store);
  });

  test('save persiste y findByActorId recupera el perfil', async () => {
    const profile = TrustProfile.create({ trustProfileId:'tp_r1', actorId:'actor_r1', actorType: ActorType.WORKER, policy: POLICY, clock });
    await repo.save(profile);
    const found = await repo.findByActorId('actor_r1');
    expect(found).not.toBeNull();
    expect(found.id).toBe('tp_r1');
  });

  test('findById retorna null si no existe', async () => {
    expect(await repo.findById('no_existe')).toBeNull();
  });

  test('replay reconstruye status correcto', async () => {
    const profile = TrustProfile.create({ trustProfileId:'tp_r2', actorId:'actor_r2', actorType: ActorType.CLIENT, policy: POLICY, clock });
    await repo.save(profile);
    const rebuilt = await repo.findById('tp_r2');
    expect(rebuilt.status.value).toBe('ACTIVE');
    expect(rebuilt.score.value).toBe(50);
  });

  test('versión incrementa correctamente tras save', async () => {
    const profile = TrustProfile.create({ trustProfileId:'tp_r3', actorId:'actor_r3', actorType: ActorType.MERCHANT, policy: POLICY, clock });
    await repo.save(profile);
    const rebuilt = await repo.findById('tp_r3');
    expect(rebuilt.version).toBe(1); // 1 evento: TrustProfileCreated
  });

  test('save múltiple: optimistic locking correcto', async () => {
    const p = TrustProfile.create({ trustProfileId:'tp_r4', actorId:'actor_r4', actorType: ActorType.WORKER, policy: POLICY, clock });
    await repo.save(p);
    const loaded = await repo.findById('tp_r4');
    loaded.applyEvidence({ dimension: 'BEHAVIOR', delta: 5, evidenceId: 'ev_1', policyVersion: 'policy-v1.0.0', clock });
    await repo.save(loaded);
    const final = await repo.findById('tp_r4');
    expect(final.version).toBe(2);
  });
});

describe('InMemoryRiskCaseRepository — ciclo de vida', () => {
  let store, repo;
  beforeEach(() => {
    store = new InMemoryEventStore();
    repo  = new InMemoryRiskCaseRepository(store);
  });

  test('save y findById recuperan RiskCase', async () => {
    const rc = RiskCase.open({ riskCaseId:'rc_r1', trustProfileId:'tp_r1', severity: RiskLevel.HIGH, triggeredBy:[], policyVersion:'policy-v1.0.0', clock });
    await repo.save(rc);
    const found = await repo.findById('rc_r1');
    expect(found.id).toBe('rc_r1');
    expect(found.status).toBe('OPEN');
  });

  test('findOpenByProfileId retorna casos abiertos', async () => {
    const rc = RiskCase.open({ riskCaseId:'rc_r2', trustProfileId:'tp_r2', severity: RiskLevel.MEDIUM, triggeredBy:[], policyVersion:'policy-v1.0.0', clock });
    await repo.save(rc);
    const open = await repo.findOpenByProfileId('tp_r2');
    expect(open).toHaveLength(1);
  });

  test('caso resuelto no aparece en findOpenByProfileId', async () => {
    const rc = RiskCase.open({ riskCaseId:'rc_r3', trustProfileId:'tp_r3', severity: RiskLevel.LOW, triggeredBy:[], policyVersion:'policy-v1.0.0', clock });
    await repo.save(rc);
    const loaded = await repo.findById('rc_r3');
    loaded.addSignal({ signalId:'s1', signalType:'VELOCITY', sourceEventId:'ev1', weight:0.3, ttlMs:3600000, clock });
    loaded.resolve({ resolution: 'CLEARED', clock });
    await repo.save(loaded);
    const open = await repo.findOpenByProfileId('tp_r3');
    expect(open).toHaveLength(0);
  });
});

describe('UnitOfWork — publish después de commit', () => {
  test('publish envía eventos de integración registrados', async () => {
    const publisher = new InMemoryPublisher();
    const store     = new InMemoryEventStore();
    const profRepo  = new InMemoryProfileRepository(store);
    const caseRepo  = new InMemoryRiskCaseRepository(store);

    const uow = new UnitOfWork({ trustProfileRepository: profRepo, riskCaseRepository: caseRepo, publisher });
    uow.registerIntegrationEvents([{ type: 'TrustScoreChanged', actorId: 'a_1', newScore: 65 }]);
    await uow.commit();
    await uow.publish();

    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0].type).toBe('TrustScoreChanged');
  });

  test('rollback limpia eventos de integración', async () => {
    const publisher = new InMemoryPublisher();
    const uow = new UnitOfWork({ trustProfileRepository: null, riskCaseRepository: null, publisher });
    uow.registerIntegrationEvents([{ type: 'X' }]);
    await uow.rollback();
    await uow.publish();
    expect(publisher.published).toHaveLength(0);
  });

  test('publish doble no envía duplicados', async () => {
    const publisher = new InMemoryPublisher();
    const uow = new UnitOfWork({ trustProfileRepository: null, riskCaseRepository: null, publisher });
    uow.registerIntegrationEvents([{ type: 'Y' }]);
    await uow.commit();
    await uow.publish();
    await uow.publish();
    expect(publisher.published).toHaveLength(1);
  });
});
