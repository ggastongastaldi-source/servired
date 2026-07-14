'use strict';

const { CreateTrustProfile }  = require('../../src/application/useCases/CreateTrustProfile');
const { ProcessDomainEvent }  = require('../../src/application/useCases/ProcessDomainEvent');
const { EvaluateRisk }        = require('../../src/application/useCases/EvaluateRisk');
const { ResolveRiskCase }     = require('../../src/application/useCases/ResolveRiskCase');
const { RehabilitateProfile } = require('../../src/application/useCases/RehabilitateProfile');
const { TrustProfile }        = require('../../src/domain/aggregates/TrustProfile');
const { RiskCase }            = require('../../src/domain/aggregates/RiskCase');
const { ActorType }           = require('../../src/domain/valueObjects/ActorType');
const { RiskLevel }           = require('../../src/domain/valueObjects/RiskLevel');
const { FixedClock }          = require('../../src/infrastructure/clock/FixedClock');
const { ConcurrencyError, DuplicateTrustProfileError, InvalidRehabilitationError } = require('../../src/domain/errors');

const clock  = new FixedClock(new Date('2025-03-01T10:00:00.000Z'));
let   idSeq  = 0;
const nextId = () => `id_${++idSeq}`;

const POLICY = {
  version: 'policy-v1.0.0',
  dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  minimumConfidenceForQuarantine:    0.3,
  minimumConfidenceForHardChallenge: 0.4,
  riskCaseThreshold:    35,
  signalCountThreshold:  3,
  assessmentTtlMs:  300_000,
  rehabilitationMinScore: 45,
  eventRules: {
    JobCancelled:     { dimension: 'BEHAVIOR', delta: -12, reason: 'trabajo cancelado' },
    PaymentCompleted: { dimension: 'ECONOMIC', delta: +8,  reason: 'pago completado'   },
  },
};

// ── Stubs en memoria ──────────────────────────────────────────────────────────

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
  async findById(id) {
    const evts = await this._es.getStream(id);
    return evts.length ? TrustProfile.rehydrate(evts) : null;
  }
  async findByActorId(actorId) {
    const id = this._idx.get(actorId);
    return id ? this.findById(id) : null;
  }
  async save(p) {
    const evts = p.pullDomainEvents();
    if (!evts.length) return;
    await this._es.append(p.id, evts, p.expectedVersion);
    if (evts.some(e => e.type === 'TrustProfileCreated')) this._idx.set(p.actorId, p.id);
  }
}

class MemRiskCaseRepo {
  constructor(es) { this._es = es; this._idx = new Map(); }
  async findById(id) {
    const evts = await this._es.getStream(id);
    return evts.length ? RiskCase.rehydrate(evts) : null;
  }
  async findOpenByProfileId(tpId) {
    const ids = this._idx.get(tpId) || [];
    const cases = await Promise.all(ids.map(id => this.findById(id)));
    return cases.filter(rc => rc && rc.isOpen);
  }
  async save(rc) {
    const evts = rc.pullDomainEvents();
    if (!evts.length) return;
    await this._es.append(rc.id, evts, rc.expectedVersion);
    const list = this._idx.get(rc.trustProfileId) || [];
    if (!list.includes(rc.id)) this._idx.set(rc.trustProfileId, [...list, rc.id]);
  }
}

class MemPublisher { constructor() { this.events = []; } async publish(evts) { this.events.push(...evts); } }
class MemEvidenceStore { constructor() { this.items = []; } async append(e) { this.items.push(e); } async getRecent() { return this.items; } }
class MemExplanationStore { constructor() { this.items = []; } async append(e) { this.items.push(e); } }
class MemPolicyRegistry { async getActivePolicy() { return POLICY; } }

function makeUoW(es, publisher, profRepo, caseRepo) {
  profRepo = profRepo || new MemProfileRepo(es);
  caseRepo = caseRepo || new MemRiskCaseRepo(es);
  return {
    trustProfiles: profRepo,
    riskCases:     caseRepo,
    _pub:          publisher,
    _events:       [],
    registerIntegrationEvents(evts) { this._events.push(...evts); },
    async commit() {},
    async publish() { if (this._events.length) { await this._pub.publish(this._events); this._events = []; } },
    async rollback() { this._events = []; },
  };
}

// ── CreateTrustProfile ────────────────────────────────────────────────────────

describe('CreateTrustProfile', () => {
  test('crea perfil y retorna trustProfileId', async () => {
    const es  = new MemEventStore();
    const pub = new MemPublisher();
    const uc  = new CreateTrustProfile({ unitOfWork: makeUoW(es, pub), policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId });
    const res = await uc.execute({ actorId: 'actor_1', actorType: 'WORKER' });
    expect(res.trustProfileId).toBeTruthy();
    expect(res.score).toBe(50);
  });

  test('publica TrustScoreChanged', async () => {
    const es  = new MemEventStore();
    const pub = new MemPublisher();
    const uc  = new CreateTrustProfile({ unitOfWork: makeUoW(es, pub), policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId });
    await uc.execute({ actorId: 'actor_2', actorType: 'CLIENT' });
    expect(pub.events.some(e => e.type === 'TrustScoreChanged')).toBe(true);
  });

  test('lanza DuplicateTrustProfileError si ya existe', async () => {
    const es  = new MemEventStore();
    const pub = new MemPublisher();
    const uc  = new CreateTrustProfile({ unitOfWork: makeUoW(es, pub), policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId });
    await uc.execute({ actorId: 'actor_dup', actorType: 'WORKER' });
    await expect(uc.execute({ actorId: 'actor_dup', actorType: 'WORKER' }))
      .rejects.toThrow(DuplicateTrustProfileError);
  });
});

// ── ProcessDomainEvent ────────────────────────────────────────────────────────

describe('ProcessDomainEvent', () => {
  async function setup() {
    const es       = new MemEventStore();
    const pub      = new MemPublisher();
    const profRepo = new MemProfileRepo(es);
    const caseRepo = new MemRiskCaseRepo(es);
    const uow      = makeUoW(es, pub, profRepo, caseRepo);
    await new CreateTrustProfile({ unitOfWork: uow, policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId })
      .execute({ actorId: 'actor_p1', actorType: 'WORKER' });
    return { es, pub, profRepo, caseRepo };
  }

  test('JobCancelled reduce score de BEHAVIOR', async () => {
    const { es, pub, profRepo, caseRepo } = await setup();
    const evStore = new MemEvidenceStore();
    const expStore = new MemExplanationStore();
    const uc = new ProcessDomainEvent({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), evidenceStore: evStore, explanationStore: expStore, clock, idGenerator: nextId });
    const res = await uc.execute({ actorId: 'actor_p1', incomingEvent: { type: 'JobCancelled', id: 'job_1' } });
    expect(res.processed).toBe(true);
    expect(res.impactsApplied).toBe(1);
  });

  test('guarda evidencia y explicación', async () => {
    const { es, pub, profRepo, caseRepo } = await setup();
    const evStore  = new MemEvidenceStore();
    const expStore = new MemExplanationStore();
    const uc = new ProcessDomainEvent({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), evidenceStore: evStore, explanationStore: expStore, clock, idGenerator: nextId });
    await uc.execute({ actorId: 'actor_p1', incomingEvent: { type: 'PaymentCompleted', id: 'pay_1' } });
    expect(evStore.items).toHaveLength(1);
    expect(expStore.items).toHaveLength(1);
  });

  test('evento sin regla retorna processed:false', async () => {
    const { es, pub, profRepo, caseRepo } = await setup();
    const uc = new ProcessDomainEvent({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), evidenceStore: new MemEvidenceStore(), explanationStore: new MemExplanationStore(), clock, idGenerator: nextId });
    const res = await uc.execute({ actorId: 'actor_p1', incomingEvent: { type: 'EventoDesconocido' } });
    expect(res.processed).toBe(false);
  });
});

// ── EvaluateRisk ──────────────────────────────────────────────────────────────

describe('EvaluateRisk', () => {
  test('score 50 no abre caso', async () => {
    const es       = new MemEventStore();
    const pub      = new MemPublisher();
    const profRepo = new MemProfileRepo(es);
    const caseRepo = new MemRiskCaseRepo(es);
    await new CreateTrustProfile({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId })
      .execute({ actorId: 'actor_e1', actorType: 'CLIENT' });
    const res = await new EvaluateRisk({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId })
      .execute({ actorId: 'actor_e1' });
    expect(res.shouldOpenCase).toBe(false);
  });
});

// ── ResolveRiskCase ───────────────────────────────────────────────────────────

describe('ResolveRiskCase', () => {
  test('resuelve un RiskCase CLEARED', async () => {
    const es  = new MemEventStore();
    const pub = new MemPublisher();
    const uow = makeUoW(es, pub);

    const rc = RiskCase.open({ riskCaseId: 'rc_uc1', trustProfileId: 'tp_x', severity: RiskLevel.HIGH, triggeredBy: [], policyVersion: 'policy-v1.0.0', clock });
    rc.addSignal({ signalId: 's1', signalType: 'VELOCITY', sourceEventId: 'ev1', weight: 0.3, ttlMs: 3600000, clock });
    await uow.riskCases.save(rc);

    const res = await new ResolveRiskCase({ unitOfWork: makeUoW(es, pub), clock })
      .execute({ riskCaseId: 'rc_uc1', resolution: 'CLEARED' });
    expect(res.resolution).toBe('CLEARED');
  });
});

// ── RehabilitateProfile ───────────────────────────────────────────────────────

describe('RehabilitateProfile', () => {
  test('lanza si el perfil no está en REHABILITATING', async () => {
    const es       = new MemEventStore();
    const pub      = new MemPublisher();
    const profRepo = new MemProfileRepo(es);
    const caseRepo = new MemRiskCaseRepo(es);
    await new CreateTrustProfile({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), clock, idGenerator: nextId })
      .execute({ actorId: 'actor_rh1', actorType: 'WORKER' });
    await expect(
      new RehabilitateProfile({ unitOfWork: makeUoW(es, pub, profRepo, caseRepo), policyRegistry: new MemPolicyRegistry(), clock })
        .execute({ actorId: 'actor_rh1' })
    ).rejects.toThrow(InvalidRehabilitationError);
  });
});
