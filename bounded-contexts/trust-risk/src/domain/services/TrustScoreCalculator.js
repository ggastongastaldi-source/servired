'use strict';

const { TrustScore }          = require('../valueObjects/TrustScore');
const { AlgorithmicConfidence }= require('../valueObjects/AlgorithmicConfidence');
const { Percentage }          = require('../valueObjects/Percentage');

/**
 * TrustScoreCalculator — servicio de dominio puro.
 * Sin I/O. Sin efectos secundarios. Testeable de forma aislada.
 * ADR-003: El score se calcula, nunca se asigna.
 */
class TrustScoreCalculator {

  /**
   * Calcula el score consolidado desde DimensionScores y la política activa.
   */
  consolidate(dimensionScores, policy) {
    return dimensionScores.consolidate(policy);
  }

  /**
   * Aplica decay a una señal según tiempo transcurrido.
   */
  applyDecay(signal, elapsedMs) {
    const { DecayFunction } = require('../valueObjects/DecayFunction');
    const fn = DecayFunction.of(signal.decayFunction || 'LINEAR');
    return fn.apply(signal.weight, elapsedMs, signal.ttlMs);
  }

  /**
   * Calcula AlgorithmicConfidence basada en evidencia histórica.
   */
  calculateConfidence({ evidenceCount, dimensionCoverage, recentEvidenceRatio }) {
    return new AlgorithmicConfidence({
      evidenceCount,
      dimensionCoverage: Math.min(1, dimensionCoverage),
      ageWeight:         Math.min(1, recentEvidenceRatio),
    });
  }

  /**
   * Calcula el delta de score para un tipo de evento según la política.
   */
  deltaForEvent(eventType, policy) {
    const rules = policy.eventRules || {};
    return rules[eventType] || { dimension: 'BEHAVIOR', delta: 0 };
  }
}

module.exports = { TrustScoreCalculator };
