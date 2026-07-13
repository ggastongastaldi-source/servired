const { Percentage, TrustScore, TrustDimension, RiskLevel, ActorType, ProfileStatus, DecayFunction, Trend, AlgorithmicConfidence, DimensionScore, DimensionScores, FrictionRecommendation, PolicyVersion } = require('../../src/domain/valueObjects');
const { InvalidScoreRangeError, InvalidProfileTransitionError, InvalidDimensionWeightsError } = require('../../src/domain/errors');

const MOCK_POLICY = {
  requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
  dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 }
};

describe('Percentage', () => {
  test('crea valor válido', () => expect(Percentage.of(0.5).value).toBe(0.5));
  test('lanza fuera de rango', () => expect(() => Percentage.of(1.1)).toThrow());
  test('ZERO y ONE son constantes', () => { expect(Percentage.ZERO.value).toBe(0); expect(Percentage.ONE.value).toBe(1); });
  test('inmutable', () => { const p = Percentage.of(0.5); try { p.value = 1; } catch(e) {} expect(p.value).toBe(0.5); });
  test('equals', () => expect(Percentage.of(0.3).equals(Percentage.of(0.3))).toBe(true));
});

describe('TrustScore', () => {
  test('valor inicial 50', () => expect(TrustScore.INITIAL.value).toBe(50));
  test('banda FULL en 80+', () => expect(TrustScore.of(85).band()).toBe('FULL'));
  test('banda CRITICAL en <20', () => expect(TrustScore.of(10).band()).toBe('CRITICAL'));
  test('apply no sale de 0-100', () => {
    expect(TrustScore.of(5).apply(-20).value).toBe(0);
    expect(TrustScore.of(95).apply(20).value).toBe(100);
  });
  test('lanza fuera de rango', () => expect(() => TrustScore.of(101)).toThrow(InvalidScoreRangeError));
  test('inmutable', () => { const s = TrustScore.of(50); try { s.value = 99; } catch(e) {} expect(s.value).toBe(50); });
});

describe('TrustDimension', () => {
  test('dimensiones base válidas', () => ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'].forEach(d => expect(() => TrustDimension.of(d)).not.toThrow()));
  test('lanza dimensión desconocida', () => expect(() => TrustDimension.of('FAKE')).toThrow());
  test('isBase()', () => expect(TrustDimension.IDENTITY.isBase()).toBe(true));
  test('equals', () => expect(TrustDimension.IDENTITY.equals(TrustDimension.of('IDENTITY'))).toBe(true));
});

describe('RiskLevel', () => {
  test('orden total: LOW < MEDIUM < HIGH < CRITICAL', () => {
    expect(RiskLevel.CRITICAL.isAbove(RiskLevel.HIGH)).toBe(true);
    expect(RiskLevel.LOW.isAbove(RiskLevel.MEDIUM)).toBe(false);
  });
  test('fromScore calcula correctamente', () => {
    expect(RiskLevel.fromScore(90).value).toBe('LOW');
    expect(RiskLevel.fromScore(15).value).toBe('CRITICAL');
  });
});

describe('ProfileStatus FSM', () => {
  test('ACTIVE puede ir a QUARANTINED', () => {
    const next = ProfileStatus.ACTIVE.transitionTo('QUARANTINED');
    expect(next.value).toBe('QUARANTINED');
  });
  test('QUARANTINED no puede ir a ACTIVE directamente', () => {
    expect(() => ProfileStatus.QUARANTINED.transitionTo('ACTIVE')).toThrow(InvalidProfileTransitionError);
  });
  test('SUSPENDED no tiene transiciones', () => {
    expect(ProfileStatus.SUSPENDED.allowedTransitions()).toHaveLength(0);
  });
  test('REHABILITATING puede volver a ACTIVE', () => {
    expect(ProfileStatus.REHABILITATING.canTransitionTo('ACTIVE')).toBe(true);
  });
});

describe('DecayFunction', () => {
  test('LINEAR decae linealmente', () => {
    const f = DecayFunction.LINEAR;
    expect(f.apply(1.0, 0, 1000)).toBeCloseTo(1.0);
    expect(f.apply(1.0, 500, 1000)).toBeCloseTo(0.5);
    expect(f.apply(1.0, 1000, 1000)).toBeCloseTo(0);
  });
  test('STEP corta en mitad del TTL', () => {
    expect(DecayFunction.STEP.apply(1.0, 400, 1000)).toBe(1.0);
    expect(DecayFunction.STEP.apply(1.0, 600, 1000)).toBe(0);
  });
});

describe('AlgorithmicConfidence', () => {
  test('NONE tiene valor 0', () => expect(AlgorithmicConfidence.NONE.value).toBe(0));
  test('crece con más evidencia', () => {
    const c1 = AlgorithmicConfidence.NONE.withNewEvidence(10);
    const c2 = c1.withNewEvidence(40);
    expect(c2.value).toBeGreaterThan(c1.value);
  });
  test('isSufficientFor', () => {
    const c = new AlgorithmicConfidence({ evidenceCount: 100, dimensionCoverage: 1, ageWeight: 1 });
    expect(c.isSufficientFor(0.7)).toBe(true);
  });
});

describe('DimensionScores', () => {
  test('consolidate con pesos correctos', () => {
    const scores = DimensionScores.withDefaults(MOCK_POLICY);
    const result = scores.consolidate(MOCK_POLICY);
    expect(result.value).toBe(50);
  });
  test('lanza si pesos no suman 1.0', () => {
    const badPolicy = { dimensionWeights: { IDENTITY: 0.5, DEVICE: 0.3 } };
    const scores = DimensionScores.empty();
    expect(() => scores.consolidate(badPolicy)).toThrow(InvalidDimensionWeightsError);
  });
  test('add es inmutable', () => {
    const s1 = DimensionScores.empty();
    const ds = new DimensionScore({ dimension:'IDENTITY', value:70, weight:0.25, trend:'STABLE', evidenceCount:1 });
    const s2 = s1.add(ds);
    expect(s1.size()).toBe(0);
    expect(s2.size()).toBe(1);
  });
});

describe('FrictionRecommendation', () => {
  test('NONE no requiere acción', () => expect(FrictionRecommendation.NONE.requiresAction()).toBe(false));
  test('HARD es más restrictivo que SOFT', () => expect(FrictionRecommendation.HARD.isMoreRestrictiveThan(FrictionRecommendation.SOFT)).toBe(true));
});

describe('PolicyVersion', () => {
  test('formato válido', () => expect(PolicyVersion.of('policy-v1.2.3').value).toBe('policy-v1.2.3'));
  test('formato inválido lanza', () => expect(() => PolicyVersion.of('v1.2')).toThrow());
  test('equals', () => expect(PolicyVersion.INITIAL.equals(PolicyVersion.of('policy-v1.0.0'))).toBe(true));
});
