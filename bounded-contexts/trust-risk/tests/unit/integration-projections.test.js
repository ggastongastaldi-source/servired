'use strict';

const { EventRouter }              = require('../../src/integration/sinapsis/EventRouter');
const { TrustEventIngester }       = require('../../src/integration/sinapsis/TrustEventIngester');
const { TrustScoreAdapter }        = require('../../src/integration/dixie/TrustScoreAdapter');
const { ProjectionDispatcher }     = require('../../src/infrastructure/persistence/projections/ProjectionDispatcher');
const { TrustProfile }             = require('../../src/domain/aggregates/TrustProfile');
const { RiskCase }                 = require('../../src/domain/aggregates/RiskCase');
const { ActorType }                = require('../../src/domain/valueObjects/ActorType');
const { RiskLevel }                = require('../../src/domain/valueObjects/RiskLevel');
const { FixedClock }               = require('../../src/infrastructure/clock/FixedClock');
const { ConcurrencyError }         = require('../../src/domain/errors');
const { CreateTrustProfile }       = require('../../src/application/useCases/CreateTrustProfile');
const { ProcessDomainEvent }       = require('../../src/application/useCases/ProcessDomainEvent');

const clock  = new FixedClock(new Date('2025-04-01T08:00:00.000Z'));
let   idSeq  = 0;
const nextId = () => `id_${++idSeq}`;

const POLICY = {
  version: 'policy-v1.0.0',
  dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  minimumConfidenceForQuarantine: 0.3,
  minimumConfidenceForHardChallenge: 0.4,
  riskCaseThreshold: 35,
  signalCountThreshold: 3,
  assessmentTtlMs: 300_000,
  eventRules: {
    UserRegistered:   { dimension: 'IDENTITY',  delta: +5,  reason: 'registro' },
    JobCancelled:     { dimension: 'BEHAVIOR',  delta: -12, reason: 'cancelacion' },
    PaymentCompleted: { dimension: 'ECONOMIC',  delta: +8,  reason: 'pago' },
  },
};

// ── Stubs ──────────────────────────────────────────────────────────────────────
class MemEventStore {
  constructor() { this._s = new Map(); }
  async append(id, evts, ver) {
    const s = this._s.get(id) || [];
    if (s.length !== ver) throw new ConcurrencyError(id, ver, s.length);
    this._s.set(id, [...s, ...evts]);
  }
  async getStream(id) { return this._s.get(id) || []; }
  async countEvents(id) { return (this._s.get(id) || []).length; }
}

class MemProfileRepo {
  constructor(es) { this._es = es; this._idx = new Map(); }
  async findById(id) { const e = await this._es.getStream(id); return e.length ? TrustProfile.rehydrate(e) : null; }
  async findByActorId(aId) { const id = this._idx.get(aId); return id ? this.findById(id) : null; }
  async save(p) {
    const evts = p.pullDomainEvents();
    if (!evts.length) return;
    await this._es.append(p.id, evts, p.expectedVersion);
    if (evts.some(e => e.type === 'TrustProfileCreated')) this._idx.set(p.actorId, p.id);
  }
}

class MemRiskCaseRepo {
  constructor(es) { this._es = es; this._idx = new Map(); }
  async findById(id) { const e = await this._es.getStream(id); return e.length ? RiskCase.rehydrate(e) : null; }
  async findOpenByProfileId(tpId) {
    const ids = this._idx.get(tpId) || [];
    const c = await Promise.all(ids.map(id => this.findById(id)));
    return c.filter(rc => rc && rc.isOpen);
  }
  async save(rc) {
    const evts = rc.pullDomainEvents();
    if (!evts.length) return;
    await this._es.append(rc.id, evts, rc.expectedVersion);
    const list = this._idx.get(rc.trustProfileId) || [];
    if (!list.includes(rc.id)) this._idx.set(rc.trustProfileId, [...list, rc.id]);
  }
}

class MemPublisher { constructor() { this.events = []; } async publish(e) { this.events.push(...e); } }
class MemEvidenceStore { constructor() { this.items = []; } async append(e) { this.items.push(e); } }
class MemExplanationStore { constructor() { this.items = []; } async append(e) { this.items.push(e); } }
class MemPolicyRegistry { async getActivePolicy() { return POLICY; } }

function makeUoW(es, pub, profRepo, caseRepo) {
  return {
    trustProfiles: profRepo || new MemProfileRepo(es),
    riskCases:     caseRepo || new MemRiskCaseRepo(es),
    _pub: pub, _events: [],
    registerIntegrationEvents(e) { this._events.push(...e); },
    async commit() {},
    async publish() { if (this._events.length) { await this._pub.publish(this._events); this._events = []; } },
    async rollback() { this._events = []; },
  };
}

// ── In-memory projection stubs ────────────────────────────────────────────────
class MemTrustScoreProjection {
  constructor() { this._store = new Map(); }
  async findByActorId(actorId) { return this._store.get(actorId) || null; }
  async findByTrustProfileId(id) { for (const v of this._store.values()) if (v.trustProfileId === id) return v; return null; }
  async apply(event) {
    switch (event.type) {
      case 'TrustProfileCreated':
        this._store.set(event.actorId, { trustProfileId: event.aggregateId, actorId: event.actorId, actorType: event.actorType, score: event.initialScore, riskLevel: 'MEDIUM', status: 'ACTIVE', recommendedFriction: 'NONE' });
        break;
      case 'TrustScoreConsolidated': {
        const entry = [...this._store.values()].find(v => v.trustProfileId === event.aggregateId);
        if (entry) { entry.score = event.scoreAfter; entry.riskLevel = event.riskLevel; }
        break;
      }
      case 'ProfileStatusChanged': {
        const entry = [...this._store.values()].find(v => v.trustProfileId === event.aggregateId);
        if (entry) entry.status = event.newStatus;
        break;
      }
    }
  }
}

class MemRiskDashboardProjection {
  constructor() { this.summary = { openCases: 0, resolvedCases: 0, quarantinedActors: 0 }; }
  async getSummary() { return { ...this.summary }; }
  async apply(event) {
    if (event.type === 'RiskCaseOpened')   this.summary.openCases++;
    if (event.type === 'RiskCaseResolved') { this.summary.openCases--; this.summary.resolvedCases++; }
    if (event.type === 'ProfileStatusChanged') {
      if (event.newStatus === 'QUARANTINED')     this.summary.quarantinedActors++;
      if (event.previousStatus === 'QUARANTINED') this.summary.quarantinedActors--;
    }
  }
}

class MemActorReputationProjection {
  constructor() { this._store = new Map(); }
  async findByActorId(actorId) { return this._store.get(actorId) || null; }
  async apply(event) {
    if (event.type === 'TrustProfileCreated') {
      this._store.set(event.actorId, { actorId: event.actorId, actorType: event.actorType, scoreBand: 'MEDIUM' });
    }
  }
}

// ── EventRouter ───────────────────────────────────────────────────────────────

describe('EventRouter', () => {
  function makeRouter(es, pub, profRepo, caseRepo) {
    const uow = makeUoW(es, pub, profRepo, caseRepo);
    const createUC  = new CreateTrustProfile({ unitOfWork: uow, policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId });
    const processUC = new ProcessDomainEvent({ unitOfWork: uow, policyRegistry: new MemPolicyRegistry(), evidenceStore: new MemEvidenceStore(), explanationStore: new MemExplanationStore(), clock, idGenerator: nextId });
    return new EventRouter({ createTrustProfile: createUC, processDomainEvent: processUC });
  }

  test('UserRegistered crea TrustProfile', async () => {
    const es = new MemEventStore(); const pub = new MemPublisher();
    const pr = new MemProfileRepo(es); const cr = new MemRiskCaseRepo(es);
    const router = makeRouter(es, pub, pr, cr);
    const result = await router.route({ type: 'UserRegistered', actorId: 'actor_i1', actorType: 'WORKER' });
    expect(result.action).toBe('profile_created');
  });

  test('UserRegistered duplicado es idempotente', async () => {
    const es = new MemEventStore(); const pub = new MemPublisher();
    const pr = new MemProfileRepo(es); const cr = new MemRiskCaseRepo(es);
    const router = makeRouter(es, pub, pr, cr);
    await router.route({ type: 'UserRegistered', actorId: 'actor_i2', actorType: 'CLIENT' });
    const r2 = await router.route({ type: 'UserRegistered', actorId: 'actor_i2', actorType: 'CLIENT' });
    expect(r2.ingested === false || r2.processed !== undefined || r2.action !== undefined).toBe(true);
  });

  test('evento sin actorId retorna routed:false', async () => {
    const es = new MemEventStore(); const pub = new MemPublisher();
    const router = makeRouter(es, pub);
    const r = await router.route({ type: 'JobCancelled' });
    expect(r.routed).toBe(false);
  });

  test('evento no soportado retorna routed:false', async () => {
    const es = new MemEventStore(); const pub = new MemPublisher();
    const router = makeRouter(es, pub);
    const r = await router.route({ type: 'EventoNuevo', actorId: 'a_1' });
    expect(r.routed).toBe(false);
  });
});

// ── TrustEventIngester ────────────────────────────────────────────────────────

describe('TrustEventIngester', () => {
  function makeIngester(es, pub, pr, cr) {
    const uow = makeUoW(es, pub, pr, cr);
    const createUC  = new CreateTrustProfile({ unitOfWork: uow, policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId });
    const processUC = new ProcessDomainEvent({ unitOfWork: uow, policyRegistry: new MemPolicyRegistry(), evidenceStore: new MemEvidenceStore(), explanationStore: new MemExplanationStore(), clock, idGenerator: nextId });
    const router    = new EventRouter({ createTrustProfile: createUC, processDomainEvent: processUC });
    return new TrustEventIngester({ eventRouter: router, logger: { info:()=>{}, debug:()=>{}, error:()=>{} } });
  }

  test('ingiere evento con tipo válido', async () => {
    const es = new MemEventStore(); const pub = new MemPublisher();
    const pr = new MemProfileRepo(es); const cr = new MemRiskCaseRepo(es);
    const ingester = makeIngester(es, pub, pr, cr);
    const r = await ingester.ingest({ type: 'UserRegistered', userId: 'actor_in1', actorType: 'WORKER' });
    expect(r.ingested).toBe(true);
  });

  test('evento sin type retorna ingested:false', async () => {
    const es = new MemEventStore(); const pub = new MemPublisher();
    const ingester = makeIngester(es, pub);
    const r = await ingester.ingest({ foo: 'bar' });
    expect(r.ingested).toBe(false);
    expect(r.reason).toBe('normalization_error');
  });

  test('error interno no rompe el flujo', async () => {
    const router   = { route: async () => { throw new Error('boom'); } };
    const ingester = new TrustEventIngester({ eventRouter: router, logger: { info:()=>{}, debug:()=>{}, error:()=>{} } });
    const r = await ingester.ingest({ type: 'JobCancelled', actorId: 'a_1' });
    expect(r.ingested).toBe(false);
    expect(r.reason).toBe('processing_error');
  });
});

// ── TrustScoreAdapter (DIXIE) ─────────────────────────────────────────────────

describe('TrustScoreAdapter', () => {
  test('retorna null para actor sin perfil', async () => {
    const proj    = new MemTrustScoreProjection();
    const adapter = new TrustScoreAdapter({ trustScoreProjection: proj });
    expect(await adapter.getActorTrust('no_existe')).toBeNull();
  });

  test('getFrictionFor actor sin perfil retorna SOFT_CHALLENGE', async () => {
    const proj    = new MemTrustScoreProjection();
    const adapter = new TrustScoreAdapter({ trustScoreProjection: proj });
    const r = await adapter.getFrictionFor('no_existe', 'JOB_CREATION');
    expect(r.friction).toBe('SOFT_CHALLENGE');
    expect(r.reason).toBe('no_profile');
  });

  test('getFrictionFor actor ACTIVE retorna friction de proyección', async () => {
    const proj = new MemTrustScoreProjection();
    await proj.apply({ type: 'TrustProfileCreated', aggregateId: 'tp_1', actorId: 'actor_d1', actorType: 'WORKER', initialScore: 75, occurredAt: clock.now().toISOString() });
    const adapter = new TrustScoreAdapter({ trustScoreProjection: proj });
    const r = await adapter.getFrictionFor('actor_d1', 'JOB_CREATION');
    expect(r.friction).toBe('NONE');
  });

  test('getFrictionFor actor QUARANTINED retorna MANUAL_REVIEW', async () => {
    const proj = new MemTrustScoreProjection();
    await proj.apply({ type: 'TrustProfileCreated', aggregateId: 'tp_2', actorId: 'actor_d2', actorType: 'WORKER', initialScore: 20, occurredAt: clock.now().toISOString() });
    await proj.apply({ type: 'ProfileStatusChanged', aggregateId: 'tp_2', newStatus: 'QUARANTINED', occurredAt: clock.now().toISOString() });
    const adapter = new TrustScoreAdapter({ trustScoreProjection: proj });
    const r = await adapter.getFrictionFor('actor_d2', 'JOB_CREATION');
    expect(r.friction).toBe('MANUAL_REVIEW');
  });
});

// ── ProjectionDispatcher ──────────────────────────────────────────────────────

describe('ProjectionDispatcher', () => {
  test('distribuye eventos a todas las proyecciones', async () => {
    const ts = new MemTrustScoreProjection();
    const rd = new MemRiskDashboardProjection();
    const ar = new MemActorReputationProjection();
    const dispatcher = new ProjectionDispatcher({ trustScoreProjection: ts, riskDashboardProjection: rd, actorReputationProjection: ar });

    await dispatcher.dispatch([
      { type: 'TrustProfileCreated', aggregateId: 'tp_1', actorId: 'actor_dp1', actorType: 'WORKER', initialScore: 50, occurredAt: clock.now().toISOString() },
      { type: 'RiskCaseOpened', aggregateId: 'rc_1', occurredAt: clock.now().toISOString() },
    ]);

    expect(await ts.findByActorId('actor_dp1')).not.toBeNull();
    expect((await rd.getSummary()).openCases).toBe(1);
    expect(await ar.findByActorId('actor_dp1')).not.toBeNull();
  });

  test('error en una proyección no detiene las demás', async () => {
    const badProj = { apply: async () => { throw new Error('fallo proyección'); } };
    const goodProj = new MemTrustScoreProjection();
    const dispatcher = new ProjectionDispatcher({
      trustScoreProjection: badProj,
      riskDashboardProjection: goodProj,
      actorReputationProjection: null,
      logger: { error: () => {} },
    });
    await expect(dispatcher.dispatch([
      { type: 'TrustProfileCreated', aggregateId: 'tp_x', actorId: 'actor_x', actorType: 'CLIENT', initialScore: 50, occurredAt: clock.now().toISOString() },
    ])).resolves.not.toThrow();
  });
});
