'use strict';

const { TrustProfile }               = require('../../src/domain/aggregates/TrustProfile');
const { RiskCase }                   = require('../../src/domain/aggregates/RiskCase');
const { OperationalRiskAssessment }  = require('../../src/domain/aggregates/OperationalRiskAssessment');
const { ActorType }                  = require('../../src/domain/valueObjects/ActorType');
const { AlgorithmicConfidence }      = require('../../src/domain/valueObjects/AlgorithmicConfidence');
const { RiskLevel }                  = require('../../src/domain/valueObjects/RiskLevel');
const { FixedClock }                 = require('../../src/infrastructure/clock/FixedClock');
const { InvalidProfileTransitionError, InvalidCaseTransitionError, InsufficientConfidenceError } = require('../../src/domain/errors');

const MOCK_POLICY = {
  version: 'policy-v1.0.0',
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  dimensionWeights:   { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
  minimumConfidenceForQuarantine:    0.3,
  minimumConfidenceForHardChallenge: 0.4,
  assessmentTtlMs: 300_000,
};

const clock = new FixedClock(new Date('2025-01-01T00:00:00.000Z'));
const mkId  = (prefix) => `${prefix}_test_001`;

// ── TrustProfile ─────────────────────────────────────────────────────────────

describe('TrustProfile — creación', () => {
  let profile;
  beforeEach(() => {
    profile = TrustProfile.create({
      trustProfileId: mkId('tp'),
      actorId:        mkId('actor'),
      actorType:      ActorType.WORKER,
      policy:         MOCK_POLICY,
      clock,
    });
  });

  test('tiene id correcto', () => expect(profile.id).toBe(mkId('tp')));
  test('actorId asignado', () => expect(profile.actorId).toBe(mkId('actor')));
  test('status inicial ACTIVE', () => expect(profile.status.value).toBe('ACTIVE'));
  test('score inicial 50', () => expect(profile.score.value).toBe(50));
  test('genera un domain event', () => {
    const events = profile.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('TrustProfileCreated');
  });
  test('pullDomainEvents limpia la cola', () => {
    profile.pullDomainEvents();
    expect(profile.pullDomainEvents()).toHaveLength(0);
  });
});

describe('TrustProfile — applyEvidence', () => {
  let profile;
  beforeEach(() => {
    profile = TrustProfile.create({ trustProfileId: mkId('tp'), actorId: mkId('a'), actorType: ActorType.CLIENT, policy: MOCK_POLICY, clock });
    profile.pullDomainEvents();
  });

  test('genera DimensionScoreUpdated', () => {
    profile.applyEvidence({ dimension: 'BEHAVIOR', delta: 10, evidenceId: 'ev_1', policyVersion: 'policy-v1.0.0', clock });
    const events = profile.pullDomainEvents();
    expect(events[0].type).toBe('DimensionScoreUpdated');
    expect(events[0].dimension).toBe('BEHAVIOR');
    expect(events[0].delta).toBe(10);
  });

  test('delta negativo reduce score de dimensión', () => {
    profile.applyEvidence({ dimension: 'BEHAVIOR', delta: -15, evidenceId: 'ev_2', policyVersion: 'policy-v1.0.0', clock });
    const events = profile.pullDomainEvents();
    expect(events[0].scoreAfter).toBe(35);
  });
});

describe('TrustProfile — recalculateScore', () => {
  let profile;
  beforeEach(() => {
    profile = TrustProfile.create({ trustProfileId: mkId('tp'), actorId: mkId('a'), actorType: ActorType.MERCHANT, policy: MOCK_POLICY, clock });
    profile.pullDomainEvents();
  });

  test('genera TrustScoreConsolidated', () => {
    profile.recalculateScore({ policy: MOCK_POLICY, clock });
    const events = profile.pullDomainEvents();
    expect(events[0].type).toBe('TrustScoreConsolidated');
  });
});

describe('TrustProfile — changeStatus FSM', () => {
  let profile;
  beforeEach(() => {
    profile = TrustProfile.create({ trustProfileId: mkId('tp'), actorId: mkId('a'), actorType: ActorType.WORKER, policy: MOCK_POLICY, clock });
    profile.pullDomainEvents();
    // darle confianza suficiente para cuarentena
    profile.updateConfidence({ dimensionCoverage: 1, ageWeight: 1, clock });
    profile.updateConfidence({ dimensionCoverage: 1, ageWeight: 1, clock });
  });

  test('ACTIVE → QUARANTINED válido con confidence suficiente', () => {
    profile.changeStatus({ newStatus: 'QUARANTINED', reason: 'test', policy: MOCK_POLICY, clock });
    const events = profile.pullDomainEvents();
    expect(events[0].type).toBe('ProfileStatusChanged');
    expect(events[0].newStatus).toBe('QUARANTINED');
  });

  test('ACTIVE → ACTIVE inválido', () => {
    expect(() => profile.changeStatus({ newStatus: 'ACTIVE', reason: 'x', policy: MOCK_POLICY, clock }))
      .toThrow(InvalidProfileTransitionError);
  });

  test('confidence insuficiente impide cuarentena', () => {
    const freshProfile = TrustProfile.create({ trustProfileId: mkId('tp2'), actorId: mkId('a2'), actorType: ActorType.CLIENT, policy: MOCK_POLICY, clock });
    expect(() => freshProfile.changeStatus({ newStatus: 'QUARANTINED', reason: 'x', policy: MOCK_POLICY, clock }))
      .toThrow(InsufficientConfidenceError);
  });
});

describe('TrustProfile — rehydrate (replay)', () => {
  test('reconstruye estado desde eventos históricos', () => {
    const original = TrustProfile.create({ trustProfileId: 'tp_replay', actorId: 'actor_r', actorType: ActorType.WORKER, policy: MOCK_POLICY, clock });
    original.applyEvidence({ dimension: 'BEHAVIOR', delta: 20, evidenceId: 'ev_r', policyVersion: 'policy-v1.0.0', clock });
    const events = original.pullDomainEvents();

    const rebuilt = TrustProfile.rehydrate(events);
    expect(rebuilt.id).toBe('tp_replay');
    expect(rebuilt.actorId).toBe('actor_r');
    expect(rebuilt.status.value).toBe('ACTIVE');
  });

  test('versión incrementa con cada evento rehydratado', () => {
    const p = TrustProfile.create({ trustProfileId: 'tp_v', actorId: 'a_v', actorType: ActorType.CLIENT, policy: MOCK_POLICY, clock });
    p.applyEvidence({ dimension: 'IDENTITY', delta: 5, evidenceId: 'e1', policyVersion: 'policy-v1.0.0', clock });
    const events = p.pullDomainEvents();

    const rebuilt = TrustProfile.rehydrate(events);
    expect(rebuilt.version).toBe(events.length);
  });
});

// ── RiskCase ─────────────────────────────────────────────────────────────────

describe('RiskCase — ciclo de vida', () => {
  let rc;
  beforeEach(() => {
    rc = RiskCase.open({ riskCaseId: 'rc_001', trustProfileId: 'tp_001', severity: RiskLevel.HIGH, triggeredBy: ['ev_1'], policyVersion: 'policy-v1.0.0', clock });
  });

  test('estado inicial OPEN', () => expect(rc.status).toBe('OPEN'));
  test('isOpen true', () => expect(rc.isOpen).toBe(true));
  test('genera RiskCaseOpened', () => {
    const events = rc.pullDomainEvents();
    expect(events[0].type).toBe('RiskCaseOpened');
  });

  test('addSignal agrega señal', () => {
    rc.addSignal({ signalId: 's_1', signalType: 'VELOCITY', sourceEventId: 'ev_1', weight: 0.3, ttlMs: 3600000, clock });
    expect(rc.signals).toHaveLength(1);
  });

  test('resolve requiere al menos una señal', () => {
    expect(() => rc.resolve({ resolution: 'CLEARED', clock })).toThrow();
  });

  test('ciclo completo OPEN → INVESTIGATING → RESOLVED', () => {
    rc.addSignal({ signalId: 's_1', signalType: 'PATTERN', sourceEventId: 'ev_1', weight: 0.5, ttlMs: 3600000, clock });
    rc.startInvestigation({ clock });
    expect(rc.status).toBe('INVESTIGATING');
    rc.resolve({ resolution: 'CONFIRMED', clock });
    expect(rc.status).toBe('RESOLVED');
    expect(rc.resolution).toBe('CONFIRMED');
  });

  test('OPEN → ESCALATED válido', () => {
    rc.escalate({ reason: 'alto impacto', clock });
    expect(rc.status).toBe('ESCALATED');
  });

  test('RESOLVED no puede transicionar', () => {
    rc.addSignal({ signalId: 's_1', signalType: 'ANOMALY', sourceEventId: 'ev_1', weight: 0.2, ttlMs: 3600000, clock });
    rc.resolve({ resolution: 'CLEARED', clock });
    expect(() => rc.resolve({ resolution: 'CONFIRMED', clock })).toThrow(InvalidCaseTransitionError);
  });

  test('rehydrate reconstruye RiskCase', () => {
    rc.addSignal({ signalId: 's_r', signalType: 'VELOCITY', sourceEventId: 'ev_r', weight: 0.4, ttlMs: 3600000, clock });
    const events  = rc.pullDomainEvents();
    const rebuilt = RiskCase.rehydrate(events);
    expect(rebuilt.id).toBe('rc_001');
    expect(rebuilt.signals).toHaveLength(1);
    expect(rebuilt.version).toBe(events.length);
  });
});

// ── OperationalRiskAssessment ─────────────────────────────────────────────────

describe('OperationalRiskAssessment', () => {
  const highConfidence = new AlgorithmicConfidence({ evidenceCount: 100, dimensionCoverage: 1, ageWeight: 1 });
  const noConfidence   = AlgorithmicConfidence.NONE;

  function makeAssessment(score, confidence) {
    return new OperationalRiskAssessment({
      assessmentId:            'ass_001',
      actorId:                 'actor_001',
      operationId:             'job_001',
      operationType:           'JOB_CREATION',
      trustSnapshotScore:      score,
      trustSnapshotConfidence: confidence,
      policy:                  MOCK_POLICY,
      clock,
    });
  }

  test('estado inicial PENDING', () => {
    const a = makeAssessment(60, highConfidence);
    expect(a.status).toBe('PENDING');
  });

  test('assess calcula riskScore y recommendation', () => {
    const a = makeAssessment(70, highConfidence);
    a.assess({ now: clock.now() });
    expect(a.status).toBe('ASSESSED');
    expect(a.riskScore).toBeGreaterThanOrEqual(0);
    expect(a.recommendation).not.toBeNull();
  });

  test('score alto produce LOW risk', () => {
    const a = makeAssessment(95, highConfidence);
    a.assess({ now: clock.now() });
    expect(a.riskLevel.value).toBe('LOW');
  });

  test('score bajo produce HIGH o CRITICAL risk', () => {
    const a = makeAssessment(10, highConfidence);
    a.assess({ now: clock.now() });
    expect(['HIGH','CRITICAL']).toContain(a.riskLevel.value);
  });

  test('confidence baja reduce fricción recomendada', () => {
    const aHigh = makeAssessment(20, highConfidence);
    const aLow  = makeAssessment(20, noConfidence);
    aHigh.assess({ now: clock.now() });
    aLow.assess({ now: clock.now() });
    expect(aHigh.recommendation.ordinal).toBeGreaterThanOrEqual(aLow.recommendation.ordinal);
  });

  test('markConsumed cambia estado', () => {
    const a = makeAssessment(50, highConfidence);
    a.assess({ now: clock.now() });
    a.markConsumed();
    expect(a.status).toBe('CONSUMED');
  });

  test('no se puede assess dos veces', () => {
    const a = makeAssessment(50, highConfidence);
    a.assess({ now: clock.now() });
    expect(() => a.assess({ now: clock.now() })).toThrow();
  });

  test('toSnapshot retorna objeto serializable', () => {
    const a = makeAssessment(65, highConfidence);
    a.assess({ now: clock.now() });
    const snap = a.toSnapshot();
    expect(snap.assessmentId).toBe('ass_001');
    expect(snap.riskScore).toBeGreaterThanOrEqual(0);
    expect(snap.explanation).not.toBeNull();
  });

  test('determinismo: mismo input produce mismo output', () => {
    const a1 = makeAssessment(55, highConfidence);
    const a2 = makeAssessment(55, highConfidence);
    a1.assess({ now: clock.now() });
    a2.assess({ now: clock.now() });
    expect(a1.riskScore).toBe(a2.riskScore);
    expect(a1.riskLevel.value).toBe(a2.riskLevel.value);
  });

  test('isExpired detecta vencimiento', () => {
    const a = makeAssessment(50, highConfidence);
    const future = new Date(clock.now().getTime() + 600_000);
    expect(a.isExpired(future)).toBe(true);
  });
});
