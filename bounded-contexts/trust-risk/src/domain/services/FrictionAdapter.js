'use strict';

const { FrictionRecommendation } = require('../valueObjects/FrictionRecommendation');
const { RiskLevel }              = require('../valueObjects/RiskLevel');

/**
 * FrictionAdapter — decide qué fricción recomendar dado un RiskLevel y Confidence.
 * ADR-009: Nunca bloqueo inmediato con confidence baja.
 * El caller (DIXIE) decide si actúa sobre la recomendación.
 */
class FrictionAdapter {

  recommend(riskLevel, confidence, policy) {
    const lvl     = riskLevel instanceof RiskLevel ? riskLevel.value : riskLevel;
    const confVal = typeof confidence === 'number' ? confidence : confidence.value;
    const minConf = policy.minimumConfidenceForQuarantine || 0.3;
    const minHard = policy.minimumConfidenceForHardChallenge || 0.4;

    // Con confidence muy baja: máximo HARD_CHALLENGE, nunca MANUAL_REVIEW
    if (confVal < minConf) {
      if (lvl === 'CRITICAL' || lvl === 'HIGH') return FrictionRecommendation.HARD;
      if (lvl === 'MEDIUM')                     return FrictionRecommendation.SOFT;
      return FrictionRecommendation.NONE;
    }

    switch (lvl) {
      case 'CRITICAL': return FrictionRecommendation.MANUAL_REVIEW;
      case 'HIGH':     return confVal >= minHard
        ? FrictionRecommendation.HARD
        : FrictionRecommendation.SOFT;
      case 'MEDIUM':   return FrictionRecommendation.SOFT;
      default:         return FrictionRecommendation.NONE;
    }
  }
}

module.exports = { FrictionAdapter };
