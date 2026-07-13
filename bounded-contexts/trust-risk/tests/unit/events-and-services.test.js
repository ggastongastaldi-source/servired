'use strict';

const { TrustProfileCreated, DimensionScoreUpdated, TrustScoreConsolidated, ProfileStatusChanged, RiskCaseOpened, RiskCaseResolved } = require('../../src/domain/events/internal');
const { TrustScoreChanged, RiskDetected, AccountQuarantined, AccountRehabilitated, IdentityVerified } = require('../../src/domain/events/integration');
const { TrustScoreCalculator } = require('../../src/domain/services/TrustScoreCalculator');
const { EvidenceCollector }    = require('../../src/domain/services/EvidenceCollector');
const { ExplanationBuilder }   = require('../../src/domain/services/ExplanationBuilder');
const { RiskEvaluator }        = require('../../src/domain/services/RiskEvaluator');
const { FrictionAdapter }      = require('../../src/domain/services/FrictionAdapter');
const { DimensionScores }      = require('../../src/domain/valueObjects/DimensionScores');
const { RiskLevel }            = require('../../src/domain/valueObjects/RiskLevel');
const { AlgorithmicConfidence }= require('../../src/domain/valueObjects/AlgorithmicConfidence');
const { FixedClock }           = require('../../src/infrastructure/clock/FixedClock');

const clock = new FixedClock(new Date('2025-06-01T12:00:00.000Z'));

const POLICY = {
  version: 'policy-v1.0.0',
  dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  minimumConfidenceForQuarantine:    0.3,
  minimumConfidenceForHardChallenge: 0.4,
  riskCaseThreshold:  35,
  signalCountThreshold: 3,
  assessmentTtlMs: 300_000,
  eventRules: {
    JobCancelled:     { dimension: 'BEHAVIOR', delta: -12, reason: 'trabajo cancelado' },
    PaymentCompleted: { dimension: 'ECONOMIC', delta: +8,  reason: 'pago completado' },
    LoginSucceeded:   [
      { dimension: 'DEVICE',    delta: +3, reason: 'login exitoso' },
      { dimension: 'BEHAVIOR',  delta: +2, reason: 'login exitoso' },
    ],
  },
  explanationTemplates: {
    JobCancelled: 'Trabajo cancelado: {dimension} bajó {delta} puntos (política {policyVersion}).',
  },
};

// ── Domain Events internos ────────────────────────────────────────────────────

describe('DomainEvent internos — inmutabilidad y schema', () => {
  test('TrustProfileCreated tiene eventId, type y actorId', () => {
    const e = new TrustProfileCreated({ trustProfileId: 'tp_1', actorId: 'a_1', actorType: 'WORKER', initialScore: 50, policyVersion: 'policy-v1.0.0', occurredAt: clock.now().toISOString() });
    expect(e.type).toBe('TrustProfileCreated');
    expect(e.actorId).toBe('a_1');
    expect(e.eventId).toBeTruthy();
  });

  test('DimensionScoreUpdated registra delta', () => {
    const e = new DimensionScoreUpdated({ trustProfileId: 'tp_1', dimension: 'BEHAVIOR', scoreBefore: 50, scoreAfter: 38, delta: -12, evidenceId: 'ev_1', policyVersion: 'policy-v1.0.0', occurredAt: clock.now().toISOString() });
    expect(e.delta).toBe(-12);
    expect(e.dimension).toBe('BEHAVIOR');
  });

  test('TrustScoreConsolidated registra riskLevel', () => {
    const e = new TrustScoreConsolidated({ trustProfileId: 'tp_1', scoreBefore: 50, scoreAfter: 35, riskLevel: 'HIGH', policyVersion: 'policy-v1.0.0', occurredAt: clock.now().toISOString() });
    expect(e.riskLevel).toBe('HIGH');
  });

  test('toJSON() retorna objeto plano serializable', () => {
    const e = new RiskCaseOpened({ riskCaseId: 'rc_1', trustProfileId: 'tp_1', severity: 'HIGH', triggeredBy: ['ev_1'], policyVersion: 'policy-v1.0.0', occurredAt: clock.now().toISOString() });
    const json = e.toJSON();
    expect(typeof json).toBe('object');
    expect(json.type).toBe('RiskCaseOpened');
    expect(JSON.stringify(json)).toBeTruthy();
  });

  test('eventos internos son inmutables', () => {
    const e = new ProfileStatusChanged({ trustProfileId: 'tp_1', previousStatus: 'ACTIVE', newStatus: 'QUARANTINED', occurredAt: clock.now().toISOString() });
    try { e.type = 'HACK'; } catch(_) {}
    expect(e.type).toBe('ProfileStatusChanged');
  });
});

// ── Integration Events ────────────────────────────────────────────────────────

describe('Integration Events hacia SINAPSIS', () => {
  test('TrustScoreChanged tiene newScore y riskLevel', () => {
    const e = new TrustScoreChanged({ actorId: 'a_1', actorType: 'WORKER', newScore: 72, riskLevel: 'MEDIUM', occurredAt: clock.now().toISOString() });
    expect(e.newScore).toBe(72);
    expect(e.type).toBe('TrustScoreChanged');
  });

  test('RiskDetected tiene severity y recommendedFriction', () => {
    const e = new RiskDetected({ actorId: 'a_1', actorType: 'CLIENT', severity: 'HIGH', recommendedFriction: 'HARD_CHALLENGE', occurredAt: clock.now().toISOString() });
    expect(e.severity).toBe('HIGH');
    expect(e.recommendedFriction).toBe('HARD_CHALLENGE');
  });

  test('AccountQuarantined tiene reason y effectiveAt', () => {
    const e = new AccountQuarantined({ actorId: 'a_1', actorType: 'WORKER', reason: 'fraude detectado', effectiveAt: clock.now().toISOString() });
    expect(e.reason).toBe('fraude detectado');
  });

  test('todos los integration events tienen eventId único', () => {
    const events = [
      new TrustScoreChanged({ actorId:'a', actorType:'WORKER', newScore:50, riskLevel:'MEDIUM', occurredAt: clock.now().toISOString() }),
      new RiskDetected({ actorId:'a', actorType:'WORKER', severity:'HIGH', recommendedFriction:'HARD', occurredAt: clock.now().toISOString() }),
      new AccountRehabilitated({ actorId:'a', actorType:'WORKER', newScore:65, effectiveAt: clock.now().toISOString() }),
      new IdentityVerified({ actorId:'a', actorType:'WORKER', method:'GOOGLE', verifiedAt: clock.now().toISOString() }),
    ];
    const ids = events.map(e => e.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── TrustScoreCalculator ──────────────────────────────────────────────────────

describe('TrustScoreCalculator', () => {
  const calc = new TrustScoreCalculator();

  test('consolidate produce score correcto con pesos balanceados', () => {
    const scores = DimensionScores.withDefaults(POLICY);
    const result = calc.consolidate(scores, POLICY);
    expect(result.value).toBe(50);
  });

  test('applyDecay LINEAR reduce peso al 50% a mitad del TTL', () => {
    const signal = { weight: 1.0, ttlMs: 10000, decayFunction: 'LINEAR' };
    const decayed = calc.applyDecay(signal, 5000);
    expect(decayed).toBeCloseTo(0.5);
  });

  test('applyDecay a TTL completo retorna 0', () => {
    const signal = { weight: 1.0, ttlMs: 5000, decayFunction: 'LINEAR' };
    expect(calc.applyDecay(signal, 5000)).toBeCloseTo(0);
  });

  test('calculateConfidence crece con evidencia', () => {
    const c1 = calc.calculateConfidence({ evidenceCount: 5,  dimensionCoverage: 0.6, recentEvidenceRatio: 0.5 });
    const c2 = calc.calculateConfidence({ evidenceCount: 80, dimensionCoverage: 1.0, recentEvidenceRatio: 0.9 });
    expect(c2.value).toBeGreaterThan(c1.value);
  });
});

// ── EvidenceCollector ─────────────────────────────────────────────────────────

describe('EvidenceCollector', () => {
  const collector = new EvidenceCollector();

  test('JobCancelled produce impacto negativo en BEHAVIOR', () => {
    const impacts = collector.collect({ type: 'JobCancelled', jobId: 'j_1' }, POLICY);
    expect(impacts).toHaveLength(1);
    expect(impacts[0].dimension).toBe('BEHAVIOR');
    expect(impacts[0].delta).toBe(-12);
  });

  test('LoginSucceeded produce dos impactos', () => {
    const impacts = collector.collect({ type: 'LoginSucceeded' }, POLICY);
    expect(impacts).toHaveLength(2);
  });

  test('evento sin regla retorna array vacío', () => {
    const impacts = collector.collect({ type: 'EventoDesconocido' }, POLICY);
    expect(impacts).toHaveLength(0);
  });

  test('hasRule detecta correctamente', () => {
    expect(collector.hasRule('PaymentCompleted', POLICY)).toBe(true);
    expect(collector.hasRule('NoExiste', POLICY)).toBe(false);
  });
});

// ── ExplanationBuilder ────────────────────────────────────────────────────────

describe('ExplanationBuilder', () => {
  const builder = new ExplanationBuilder();

  test('build retorna explanation con humanReadable', () => {
    const exp = builder.build({
      evidenceId: 'ev_1', trustProfileId: 'tp_1',
      dimension: 'BEHAVIOR', delta: -12,
      scoreBefore: 50, scoreAfter: 38,
      confidenceBefore: 0.3, confidenceAfter: 0.32,
      sourceEventType: 'JobCancelled',
      policy: POLICY, rule: 'JobCancelled', clock,
    });
    expect(exp.humanReadable).toContain('cancelado');
    expect(exp.delta).toBe(-12);
    expect(exp.explanationId).toBeTruthy();
  });

  test('usa template por defecto cuando no existe regla', () => {
    const exp = builder.build({
      evidenceId: 'ev_2', trustProfileId: 'tp_1',
      dimension: 'ECONOMIC', delta: 8,
      scoreBefore: 50, scoreAfter: 58,
      confidenceBefore: 0.4, confidenceAfter: 0.41,
      sourceEventType: 'PaymentCompleted',
      policy: POLICY, rule: 'PaymentCompleted', clock,
    });
    expect(exp.humanReadable).toContain('ECONOMIC');
  });
});

// ── RiskEvaluator ─────────────────────────────────────────────────────────────

describe('RiskEvaluator', () => {
  const evaluator = new RiskEvaluator();
  const highConf  = new AlgorithmicConfidence({ evidenceCount: 100, dimensionCoverage: 1, ageWeight: 1 });

  const makeProfile = (score) => ({
    id: 'tp_1',
    score: { value: score, isBelow: (t) => score < t },
    confidence: highConf,
  });

  test('score bajo abre caso', () => {
    const result = evaluator.evaluate(makeProfile(25), [], POLICY);
    expect(result.shouldOpenCase).toBe(true);
  });

  test('score alto no abre caso', () => {
    const result = evaluator.evaluate(makeProfile(75), [], POLICY);
    expect(result.shouldOpenCase).toBe(false);
  });

  test('muchas señales abren caso aunque score sea bueno', () => {
    const signals = [{},{},{}];
    const result  = evaluator.evaluate(makeProfile(70), signals, POLICY);
    expect(result.shouldOpenCase).toBe(true);
  });

  test('shouldQuarantine requiere CRITICAL + confidence', () => {
    const assessment = { severity: 'CRITICAL', confidence: 0.8 };
    expect(evaluator.shouldQuarantine(assessment, POLICY)).toBe(true);
  });

  test('shouldQuarantine false con confidence baja', () => {
    const assessment = { severity: 'CRITICAL', confidence: 0.1 };
    expect(evaluator.shouldQuarantine(assessment, POLICY)).toBe(false);
  });
});

// ── FrictionAdapter ───────────────────────────────────────────────────────────

describe('FrictionAdapter', () => {
  const adapter  = new FrictionAdapter();
  const highConf = 0.8;
  const lowConf  = 0.1;

  test('CRITICAL + alta confidence → MANUAL_REVIEW', () => {
    const rec = adapter.recommend(RiskLevel.CRITICAL, highConf, POLICY);
    expect(rec.level).toBe('MANUAL_REVIEW');
  });

  test('CRITICAL + baja confidence → HARD_CHALLENGE', () => {
    const rec = adapter.recommend(RiskLevel.CRITICAL, lowConf, POLICY);
    expect(rec.level).toBe('HARD_CHALLENGE');
  });

  test('LOW + cualquier confidence → NONE', () => {
    expect(adapter.recommend(RiskLevel.LOW, highConf, POLICY).level).toBe('NONE');
    expect(adapter.recommend(RiskLevel.LOW, lowConf, POLICY).level).toBe('NONE');
  });

  test('MEDIUM → SOFT_CHALLENGE', () => {
    expect(adapter.recommend(RiskLevel.MEDIUM, highConf, POLICY).level).toBe('SOFT_CHALLENGE');
  });

  test('ADR-009: nunca MANUAL_REVIEW con confidence insuficiente', () => {
    const rec = adapter.recommend(RiskLevel.CRITICAL, 0.1, POLICY);
    expect(rec.level).not.toBe('MANUAL_REVIEW');
  });
});
