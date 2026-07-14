'use strict';

/**
 * Fase 10 — Tests de replay, determinismo e invariantes.
 *
 * Valida las garantías fundamentales del sistema:
 * - ADR-003: mismo Event Store + misma política = mismo score (determinismo)
 * - ADR-004: replay con política diferente produce resultado diferente y auditable
 * - ADR-007: el estado reconstruido desde eventos es idéntico al estado en memoria
 * - ADR-008: toda mutación produce una Explanation recuperable
 * - ADR-009: invariante de Confidence antes de cuarentena
 * - Casos límite: score en bordes 0/100, señales con TTL vencido, etc.
 */

const { TrustProfile }        = require('../../src/domain/aggregates/TrustProfile');
const { RiskCase }            = require('../../src/domain/aggregates/RiskCase');
const { ActorType }           = require('../../src/domain/valueObjects/ActorType');
const { RiskLevel }           = require('../../src/domain/valueObjects/RiskLevel');
const { TrustScore }          = require('../../src/domain/valueObjects/TrustScore');
const { ProfileStatus }       = require('../../src/domain/valueObjects/ProfileStatus');
const { AlgorithmicConfidence } = require('../../src/domain/valueObjects/AlgorithmicConfidence');
const { DecayFunction }       = require('../../src/domain/valueObjects/DecayFunction');
const { FixedClock }          = require('../../src/infrastructure/clock/FixedClock');
const { TrustScoreCalculator } = require('../../src/domain/services/TrustScoreCalculator');
const { EvidenceCollector }   = require('../../src/domain/services/EvidenceCollector');
const { ExplanationBuilder }  = require('../../src/domain/services/ExplanationBuilder');
const { FrictionAdapter }     = require('../../src/domain/services/FrictionAdapter');
const { CreateTrustProfile }  = require('../../src/application/useCases/CreateTrustProfile');
const { ProcessDomainEvent }  = require('../../src/application/useCases/ProcessDomainEvent');
const { ConcurrencyError, InsufficientConfidenceError, InvalidProfileTransitionError } = require('../../src/domain/errors');

const clock  = new FixedClock(new Date('2025-05-01T00:00:00.000Z'));
let   idSeq  = 0;
const nextId = () => `id_test_${++idSeq}`;

const POLICY_V1 = {
  version: 'policy-v1.0.0',
  dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  minimumConfidenceForQuarantine:    0.30,
  minimumConfidenceForHardChallenge: 0.40,
  riskCaseThreshold:   35,
  signalCountThreshold: 3,
  assessmentTtlMs:  300_000,
  eventRules: {
    JobCancelled:     { dimension: 'BEHAVIOR', delta: -12, reason: 'cancelacion' },
    PaymentCompleted: { dimension: 'ECONOMIC', delta: +8,  reason: 'pago' },
    LoginSucceeded:   { dimension: 'DEVICE',   delta: +3,  reason: 'login' },
    ReviewSubmitted:  { dimension: 'NETWORK',  delta: +5,  reason: 'resena' },
  },
};

// Política v2: pesos diferentes — para test de versionado
const POLICY_V2 = {
  ...POLICY_V1,
  version: 'policy-v2.0.0',
  dimensionWeights: { IDENTITY:0.10, DEVICE:0.10, BEHAVIOR:0.50, ECONOMIC:0.20, NETWORK:0.10 },
};

// ── Stubs en memoria ──────────────────────────────────────────────────────────
class MemEventStore {
  constructor() { this._s = new Map(); }
  async append(id, evts, ver) {
    const s = this._s.get(id) || [];
    if (s.length !== ver) throw new ConcurrencyError(id, ver, s.length);
    this._s.set(id, [...s, ...evts]);
  }
  async getStream(id, from = 0) { return (this._s.get(id) || []).slice(from); }
  async countEvents(id) { return (this._s.get(id) || []).length; }
  allStreams() { return this._s; }
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

class MemPublisher   { constructor() { this.events = []; } async publish(e) { this.events.push(...e); } }
class MemEvStore     { constructor() { this.items = []; }  async append(e) { this.items.push(e); } async getRecent() { return this.items; } }
class MemExpStore    { constructor() { this.items = []; }  async append(e) { this.items.push(e); } }
class MemPolicyReg   { constructor(p) { this._p = p; } async getActivePolicy() { return this._p; } }

function makeUoW(es, pub, pr, cr) {
  return {
    trustProfiles: pr || new MemProfileRepo(es),
    riskCases:     cr || new MemRiskCaseRepo(es),
    _pub: pub, _events: [],
    registerIntegrationEvents(e) { this._events.push(...e); },
    async commit() {},
    async publish() { if (this._events.length) { await this._pub.publish(this._events); this._events = []; } },
    async rollback() { this._events = []; },
  };
}

async function buildScenario(policy = POLICY_V1) {
  const es  = new MemEventStore();
  const pub = new MemPublisher();
  const pr  = new MemProfileRepo(es);
  const cr  = new MemRiskCaseRepo(es);
  const evS = new MemEvStore();
  const exS = new MemExpStore();

  const createUC = new CreateTrustProfile({
    unitOfWork: makeUoW(es, pub, pr, cr),
    policyRegistry: new MemPolicyReg(policy),
    clock, idGenerator: nextId,
  });
  const res = await createUC.execute({ actorId: 'actor_replay', actorType: 'WORKER' });

  return { es, pub, pr, cr, evS, exS, trustProfileId: res.trustProfileId };
}

// ── ADR-003: Determinismo del replay ─────────────────────────────────────────

describe('ADR-003 — Determinismo del replay', () => {

  test('replay produce el mismo score que el estado en memoria', async () => {
    const { es, pub, pr, cr, evS, exS, trustProfileId } = await buildScenario();

    const processUC = new ProcessDomainEvent({
      unitOfWork: makeUoW(es, pub, pr, cr),
      policyRegistry: new MemPolicyReg(POLICY_V1),
      evidenceStore: evS, explanationStore: exS,
      clock, idGenerator: nextId,
    });

    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'JobCancelled', id: 'j1' } });
    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'PaymentCompleted', id: 'p1' } });
    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'LoginSucceeded', id: 'l1' } });

    // Estado en memoria
    const liveProfile = await pr.findByActorId('actor_replay');

    // Replay desde Event Store
    const events       = await es.getStream(trustProfileId);
    const replayProfile = TrustProfile.rehydrate(events);

    expect(replayProfile.score.value).toBe(liveProfile.score.value);
    expect(replayProfile.status.value).toBe(liveProfile.status.value);
    expect(replayProfile.actorId).toBe(liveProfile.actorId);
  });

  test('mismo stream de eventos produce siempre el mismo score', async () => {
    const events = [
      { type: 'TrustProfileCreated', aggregateId: 'tp_det', actorId: 'a_det', actorType: 'CLIENT', initialScore: 50, policyVersion: 'policy-v1.0.0', occurredAt: '2025-01-01T00:00:00.000Z' },
      { type: 'DimensionScoreUpdated', aggregateId: 'tp_det', dimension: 'BEHAVIOR', scoreBefore: 50, scoreAfter: 38, delta: -12, evidenceId: 'ev1', policyVersion: 'policy-v1.0.0', occurredAt: '2025-01-01T01:00:00.000Z' },
      { type: 'TrustScoreConsolidated', aggregateId: 'tp_det', scoreBefore: 50, scoreAfter: 46, riskLevel: 'MEDIUM', policyVersion: 'policy-v1.0.0', occurredAt: '2025-01-01T01:00:01.000Z' },
    ];

    const p1 = TrustProfile.rehydrate(events);
    const p2 = TrustProfile.rehydrate(events);
    const p3 = TrustProfile.rehydrate(events);

    expect(p1.score.value).toBe(p2.score.value);
    expect(p2.score.value).toBe(p3.score.value);
    expect(p1.version).toBe(p2.version);
  });

  test('versión del perfil = número de eventos en el stream', async () => {
    const { es, pub, pr, cr, evS, exS, trustProfileId } = await buildScenario();
    const processUC = new ProcessDomainEvent({
      unitOfWork: makeUoW(es, pub, pr, cr),
      policyRegistry: new MemPolicyReg(POLICY_V1),
      evidenceStore: evS, explanationStore: exS,
      clock, idGenerator: nextId,
    });

    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'JobCancelled', id: 'j2' } });

    const eventCount = await es.countEvents(trustProfileId);
    const profile    = await pr.findByActorId('actor_replay');
    expect(profile.version).toBe(eventCount);
  });
});

// ── ADR-004: Versionado de políticas ─────────────────────────────────────────

describe('ADR-004 — Versionado de políticas', () => {

  test('mismos eventos + política diferente = score diferente', () => {
    const events = [
      { type: 'TrustProfileCreated', aggregateId: 'tp_pol', actorId: 'a_pol', actorType: 'WORKER', initialScore: 50, policyVersion: 'policy-v1.0.0', occurredAt: '2025-01-01T00:00:00.000Z' },
      { type: 'DimensionScoreUpdated', aggregateId: 'tp_pol', dimension: 'BEHAVIOR', scoreBefore: 50, scoreAfter: 38, delta: -12, evidenceId: 'ev1', policyVersion: 'policy-v1.0.0', occurredAt: '2025-01-01T01:00:00.000Z' },
    ];

    const profile = TrustProfile.rehydrate(events);

    const calc   = new TrustScoreCalculator();
    const scoreV1 = calc.consolidate(profile.scores, POLICY_V1).value;
    const scoreV2 = calc.consolidate(profile.scores, POLICY_V2).value;

    // BEHAVIOR tiene más peso en V2 (0.50 vs 0.30), score debería diferir
    expect(scoreV1).not.toBe(scoreV2);
  });

  test('cada evidencia registra la versión de política que la produjo', async () => {
    const { es, pub, pr, cr, evS, exS } = await buildScenario();
    const processUC = new ProcessDomainEvent({
      unitOfWork: makeUoW(es, pub, pr, cr),
      policyRegistry: new MemPolicyReg(POLICY_V1),
      evidenceStore: evS, explanationStore: exS,
      clock, idGenerator: nextId,
    });

    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'PaymentCompleted', id: 'p2' } });

    expect(evS.items[0].appliedPolicy).toBe('policy-v1.0.0');
  });
});

// ── ADR-007: Event Store como fuente de verdad ────────────────────────────────

describe('ADR-007 — Event Store como fuente de verdad', () => {

  test('optimistic locking previene escrituras concurrentes', async () => {
    const es = new MemEventStore();
    await es.append('tp_lock', [{ type: 'A' }], 0);
    await expect(es.append('tp_lock', [{ type: 'B' }], 0))
      .rejects.toThrow(ConcurrencyError);
  });

  test('streams de distintos agregados son completamente independientes', async () => {
    const es = new MemEventStore();
    await es.append('tp_a', [{ type: 'X1' }, { type: 'X2' }], 0);
    await es.append('tp_b', [{ type: 'Y1' }], 0);

    expect(await es.countEvents('tp_a')).toBe(2);
    expect(await es.countEvents('tp_b')).toBe(1);
    expect(await es.countEvents('tp_c')).toBe(0);
  });

  test('replay parcial desde versión N retorna solo eventos posteriores', async () => {
    const es = new MemEventStore();
    await es.append('tp_partial', [
      { type: 'A', seq: 1 },
      { type: 'B', seq: 2 },
      { type: 'C', seq: 3 },
    ], 0);

    const from2 = await es.getStream('tp_partial', 2);
    expect(from2).toHaveLength(1);
    expect(from2[0].type).toBe('C');
  });

  test('append múltiple en un solo call es atómico', async () => {
    const es = new MemEventStore();
    await es.append('tp_atomic', [{ type: 'A' }, { type: 'B' }, { type: 'C' }], 0);
    expect(await es.countEvents('tp_atomic')).toBe(3);
  });
});

// ── ADR-008: Explicabilidad ───────────────────────────────────────────────────

describe('ADR-008 — Explicabilidad', () => {

  test('toda mutación de score produce una Explanation', async () => {
    const { es, pub, pr, cr, evS, exS } = await buildScenario();
    const processUC = new ProcessDomainEvent({
      unitOfWork: makeUoW(es, pub, pr, cr),
      policyRegistry: new MemPolicyReg(POLICY_V1),
      evidenceStore: evS, explanationStore: exS,
      clock, idGenerator: nextId,
    });

    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'JobCancelled', id: 'j3' } });
    await processUC.execute({ actorId: 'actor_replay', incomingEvent: { type: 'PaymentCompleted', id: 'p3' } });

    expect(exS.items).toHaveLength(2);
    expect(exS.items[0].humanReadable).toBeTruthy();
    expect(exS.items[0].policyVersion).toBe('policy-v1.0.0');
  });

  test('Explanation contiene todos los campos requeridos por GIA', async () => {
    const builder = new ExplanationBuilder();
    const exp = builder.build({
      evidenceId: 'ev_gia', trustProfileId: 'tp_gia',
      dimension: 'BEHAVIOR', delta: -12,
      scoreBefore: 50, scoreAfter: 38,
      confidenceBefore: 0.3, confidenceAfter: 0.31,
      sourceEventType: 'JobCancelled',
      policy: POLICY_V1, rule: 'JobCancelled', clock,
    });

    expect(exp.explanationId).toBeTruthy();
    expect(exp.evidenceId).toBe('ev_gia');
    expect(exp.policyVersion).toBe('policy-v1.0.0');
    expect(exp.ruleId).toBeTruthy();
    expect(exp.dimension).toBe('BEHAVIOR');
    expect(exp.delta).toBe(-12);
    expect(exp.humanReadable).toBeTruthy();
    expect(exp.timestamp).toBeTruthy();
  });

  test('ExplanationBuilder usa template de política cuando existe', () => {
    const policyWithTemplate = {
      ...POLICY_V1,
      explanationTemplates: {
        JobCancelled: 'TEMPLATE: dimensión {dimension} delta {delta} política {policyVersion}',
      },
    };
    const builder = new ExplanationBuilder();
    const exp = builder.build({
      evidenceId: 'ev_t', trustProfileId: 'tp_t',
      dimension: 'BEHAVIOR', delta: -12,
      scoreBefore: 50, scoreAfter: 38,
      confidenceBefore: 0.3, confidenceAfter: 0.31,
      sourceEventType: 'JobCancelled',
      policy: policyWithTemplate, rule: 'JobCancelled', clock,
    });
    expect(exp.humanReadable).toContain('TEMPLATE');
    expect(exp.humanReadable).toContain('BEHAVIOR');
    expect(exp.humanReadable).toContain('policy-v1.0.0');
  });
});

// ── ADR-009: Invariante de Confidence ────────────────────────────────────────

describe('ADR-009 — Invariante de Confidence', () => {

  test('perfil nuevo no puede ser cuarentenado (confidence insuficiente)', () => {
    const profile = TrustProfile.create({
      trustProfileId: 'tp_conf1', actorId: 'a_conf1',
      actorType: ActorType.WORKER, policy: POLICY_V1, clock,
    });
    profile.pullDomainEvents();

    expect(() => profile.changeStatus({
      newStatus: 'QUARANTINED', reason: 'test',
      policy: POLICY_V1, clock,
    })).toThrow(InsufficientConfidenceError);
  });

  test('con confidence suficiente permite cuarentena', () => {
    const profile = TrustProfile.create({
      trustProfileId: 'tp_conf2', actorId: 'a_conf2',
      actorType: ActorType.CLIENT, policy: POLICY_V1, clock,
    });
    profile.pullDomainEvents();

    // Simular evidencia acumulada suficiente
    for (let i = 0; i < 5; i++) {
      profile.updateConfidence({ dimensionCoverage: 1, ageWeight: 1, clock });
    }

    expect(() => profile.changeStatus({
      newStatus: 'QUARANTINED', reason: 'fraude detectado',
      policy: POLICY_V1, clock,
    })).not.toThrow();
  });

  test('FrictionAdapter nunca da MANUAL_REVIEW con confidence < umbral', () => {
    const adapter = new FrictionAdapter();
    const rec = adapter.recommend(RiskLevel.CRITICAL, 0.05, POLICY_V1);
    expect(rec.level).not.toBe('MANUAL_REVIEW');
    expect(['SOFT_CHALLENGE','HARD_CHALLENGE']).toContain(rec.level);
  });

  test('AlgorithmicConfidence crece monotónicamente con más evidencia', () => {
    const values = [5, 20, 50, 100].map(n =>
      new AlgorithmicConfidence({ evidenceCount: n, dimensionCoverage: 0.8, ageWeight: 0.7 }).value
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i-1]);
    }
  });
});

// ── Casos límite ──────────────────────────────────────────────────────────────

describe('Casos límite', () => {

  test('score nunca baja de 0 aunque los deltas sean muy negativos', () => {
    const profile = TrustProfile.create({
      trustProfileId: 'tp_limit1', actorId: 'a_limit1',
      actorType: ActorType.WORKER, policy: POLICY_V1, clock,
    });
    profile.pullDomainEvents();

    for (let i = 0; i < 10; i++) {
      profile.applyEvidence({ dimension: 'BEHAVIOR', delta: -50, evidenceId: `ev_${i}`, policyVersion: 'policy-v1.0.0', clock });
    }

    const score = profile.scores.get('BEHAVIOR').score.value;
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('score nunca sube de 100 aunque los deltas sean muy positivos', () => {
    const profile = TrustProfile.create({
      trustProfileId: 'tp_limit2', actorId: 'a_limit2',
      actorType: ActorType.CLIENT, policy: POLICY_V1, clock,
    });
    profile.pullDomainEvents();

    for (let i = 0; i < 10; i++) {
      profile.applyEvidence({ dimension: 'ECONOMIC', delta: +50, evidenceId: `ev_${i}`, policyVersion: 'policy-v1.0.0', clock });
    }

    const score = profile.scores.get('ECONOMIC').score.value;
    expect(score).toBeLessThanOrEqual(100);
  });

  test('DecayFunction LINEAR a TTL completo retorna 0', () => {
    const calc    = new TrustScoreCalculator();
    const signal  = { weight: 1.0, ttlMs: 3600000, decayFunction: 'LINEAR' };
    expect(calc.applyDecay(signal, 3600000)).toBeCloseTo(0);
  });

  test('DecayFunction EXPONENTIAL decae más rápido que LINEAR', () => {
    const calc   = new TrustScoreCalculator();
    const signal = { weight: 1.0, ttlMs: 10000, decayFunction: 'LINEAR' };
    const sigExp = { weight: 1.0, ttlMs: 10000, decayFunction: 'EXPONENTIAL' };
    const linear = calc.applyDecay(signal, 5000);
    const expo   = calc.applyDecay(sigExp, 5000);
    expect(expo).toBeLessThan(linear);
  });

  test('RiskCase no puede resolverse sin señales registradas', () => {
    const rc = RiskCase.open({
      riskCaseId: 'rc_limit', trustProfileId: 'tp_x',
      severity: RiskLevel.HIGH, triggeredBy: [],
      policyVersion: 'policy-v1.0.0', clock,
    });
    expect(() => rc.resolve({ resolution: 'CLEARED', clock })).toThrow();
  });

  test('ProfileStatus FSM: SUSPENDED no tiene transiciones', () => {
    expect(ProfileStatus.SUSPENDED.allowedTransitions()).toHaveLength(0);
  });

  test('TrustScore en banda correcta en todos los bordes', () => {
    expect(TrustScore.of(0).band()).toBe('CRITICAL');
    expect(TrustScore.of(19).band()).toBe('CRITICAL');
    expect(TrustScore.of(20).band()).toBe('LOW');
    expect(TrustScore.of(39).band()).toBe('LOW');
    expect(TrustScore.of(40).band()).toBe('MEDIUM');
    expect(TrustScore.of(59).band()).toBe('MEDIUM');
    expect(TrustScore.of(60).band()).toBe('HIGH');
    expect(TrustScore.of(79).band()).toBe('HIGH');
    expect(TrustScore.of(80).band()).toBe('FULL');
    expect(TrustScore.of(100).band()).toBe('FULL');
  });

  test('EvidenceCollector: evento sin regla no produce impactos', () => {
    const collector = new EvidenceCollector();
    const impacts   = collector.collect({ type: 'EventoFuturo', actorId: 'a' }, POLICY_V1);
    expect(impacts).toHaveLength(0);
  });

  test('replay de RiskCase reproduce ciclo completo correctamente', () => {
    const rc = RiskCase.open({
      riskCaseId: 'rc_rep', trustProfileId: 'tp_rep',
      severity: RiskLevel.CRITICAL, triggeredBy: ['ev_1'],
      policyVersion: 'policy-v1.0.0', clock,
    });
    rc.addSignal({ signalId: 's1', signalType: 'VELOCITY', sourceEventId: 'ev1', weight: 0.8, ttlMs: 3600000, clock });
    rc.startInvestigation({ clock });
    rc.resolve({ resolution: 'CONFIRMED', clock });
    const events = rc.pullDomainEvents();

    const rebuilt = RiskCase.rehydrate(events);
    expect(rebuilt.status).toBe('RESOLVED');
    expect(rebuilt.resolution).toBe('CONFIRMED');
    expect(rebuilt.signals).toHaveLength(1);
    expect(rebuilt.version).toBe(events.length);
  });
});

// ── Test de regresión integral ────────────────────────────────────────────────

describe('Regresión integral — flujo completo', () => {

  test('flujo: registro → cancelación → pago → replay = estado consistente', async () => {
    const es  = new MemEventStore();
    const pub = new MemPublisher();
    const pr  = new MemProfileRepo(es);
    const cr  = new MemRiskCaseRepo(es);
    const evS = new MemEvStore();
    const exS = new MemExpStore();

    // 1. Crear perfil
    const createUC = new CreateTrustProfile({
      unitOfWork: makeUoW(es, pub, pr, cr),
      policyRegistry: new MemPolicyReg(POLICY_V1),
      clock, idGenerator: nextId,
    });
    const { trustProfileId } = await createUC.execute({ actorId: 'actor_reg', actorType: 'WORKER' });

    // 2. Aplicar eventos de negocio
    const processUC = new ProcessDomainEvent({
      unitOfWork: makeUoW(es, pub, pr, cr),
      policyRegistry: new MemPolicyReg(POLICY_V1),
      evidenceStore: evS, explanationStore: exS,
      clock, idGenerator: nextId,
    });

    await processUC.execute({ actorId: 'actor_reg', incomingEvent: { type: 'JobCancelled',     id: 'j_reg1' } });
    await processUC.execute({ actorId: 'actor_reg', incomingEvent: { type: 'PaymentCompleted', id: 'p_reg1' } });
    await processUC.execute({ actorId: 'actor_reg', incomingEvent: { type: 'ReviewSubmitted',  id: 'r_reg1' } });

    // 3. Estado en memoria
    const liveProfile = await pr.findByActorId('actor_reg');

    // 4. Replay completo desde el Event Store
    const allEvents    = await es.getStream(trustProfileId);
    const replayProfile = TrustProfile.rehydrate(allEvents);

    // 5. Validar consistencia
    expect(replayProfile.id).toBe(liveProfile.id);
    expect(replayProfile.score.value).toBe(liveProfile.score.value);
    expect(replayProfile.actorId).toBe('actor_reg');
    expect(replayProfile.version).toBe(allEvents.length);

    // 6. Evidencias y explicaciones generadas
    expect(evS.items.length).toBeGreaterThan(0);
    expect(exS.items.length).toBe(evS.items.length);

    // 7. Integration events publicados
    expect(pub.events.some(e => e.type === 'TrustScoreChanged')).toBe(true);
  });
});
