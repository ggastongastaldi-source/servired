'use strict';

const { RiskLevel } = require('../valueObjects/RiskLevel');

/**
 * RiskEvaluator — evalúa si un TrustProfile debe abrir un RiskCase.
 * Lógica pura. Consulta la política para umbrales.
 * ADR-004: Las reglas viven en la política.
 */
class RiskEvaluator {

  /**
   * Evalúa el perfil y retorna una RiskAssessment estructurada.
   */
  evaluate(profile, activeSignals, policy) {
    const score      = profile.score.value;
    const confidence = profile.confidence.value;
    const riskLevel  = RiskLevel.fromScore(score);

    const shouldOpen = this._shouldOpenCase(score, activeSignals, confidence, policy);
    const severity   = this._deriveSeverity(score, activeSignals, policy);

    return {
      trustProfileId: profile.id,
      score,
      confidence,
      riskLevel:      riskLevel.value,
      activeSignals:  activeSignals.length,
      shouldOpenCase: shouldOpen,
      severity,
      evaluatedAt:    new Date().toISOString(),
    };
  }

  /**
   * Determina si la confianza es suficiente para cuarentena.
   * ADR-009.
   */
  shouldQuarantine(assessment, policy) {
    const minConf = policy.minimumConfidenceForQuarantine || 0.3;
    return assessment.severity === 'CRITICAL'
      && assessment.confidence >= minConf;
  }

  _shouldOpenCase(score, signals, confidence, policy) {
    const threshold = policy.riskCaseThreshold || 35;
    return score <= threshold || signals.length >= (policy.signalCountThreshold || 3);
  }

  _deriveSeverity(score, signals, policy) {
    if (score < 20 || signals.length >= 5) return 'CRITICAL';
    if (score < 35 || signals.length >= 3) return 'HIGH';
    if (score < 50 || signals.length >= 1) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = { RiskEvaluator };
