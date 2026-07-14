'use strict';

/**
 * TrustScoreAdapter — interfaz de lectura para DIXIE.
 *
 * ADR-005: DIXIE solo consulta Trust, nunca lo modifica.
 * DIXIE lee la proyección TrustScoreProjection, no el agregado.
 *
 * Este adapter es la única interfaz pública que DIXIE conoce
 * del bounded context Trust & Risk.
 */
class TrustScoreAdapter {

  constructor({ trustScoreProjection }) {
    this._projection = trustScoreProjection;
  }

  /**
   * Retorna el score y nivel de riesgo de un actor.
   * Usado por DIXIE antes de ejecutar un comando.
   *
   * @param {string} actorId
   * @returns {Promise<{ score, riskLevel, status, confidence } | null>}
   */
  async getActorTrust(actorId) {
    return this._projection.findByActorId(actorId);
  }

  /**
   * Determina si un actor requiere fricción para una operación.
   * DIXIE llama esto — nunca accede al dominio directamente.
   *
   * @param {string} actorId
   * @param {string} operationType
   * @returns {Promise<{ friction: string, score: number, riskLevel: string }>}
   */
  async getFrictionFor(actorId, operationType) {
    const trust = await this._projection.findByActorId(actorId);

    if (!trust) {
      // Actor sin perfil: fricción conservadora por defecto
      return { friction: 'SOFT_CHALLENGE', score: null, riskLevel: 'UNKNOWN', reason: 'no_profile' };
    }

    if (trust.status === 'QUARANTINED' || trust.status === 'SUSPENDED') {
      return { friction: 'MANUAL_REVIEW', score: trust.score, riskLevel: trust.riskLevel, reason: 'account_restricted' };
    }

    return {
      friction:  trust.recommendedFriction || 'NONE',
      score:     trust.score,
      riskLevel: trust.riskLevel,
      reason:    'policy_evaluation',
    };
  }
}

module.exports = { TrustScoreAdapter };
