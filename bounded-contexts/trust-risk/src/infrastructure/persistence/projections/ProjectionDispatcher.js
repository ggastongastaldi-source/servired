'use strict';

/**
 * ProjectionDispatcher — aplica eventos de dominio a todas las proyecciones.
 *
 * Patrón: event-driven projection update.
 * Llamado por el Repository después de persistir eventos en el Event Store.
 *
 * Si una proyección falla, registra el error sin romper el flujo principal.
 * Las proyecciones son reconstruibles desde el Event Store en cualquier momento.
 */
class ProjectionDispatcher {

  constructor({ trustScoreProjection, riskDashboardProjection, actorReputationProjection, logger }) {
    this._projections = [
      trustScoreProjection,
      riskDashboardProjection,
      actorReputationProjection,
    ].filter(Boolean);
    this._logger = logger || console;
  }

  async dispatch(events) {
    for (const event of events) {
      for (const projection of this._projections) {
        try {
          await projection.apply(event);
        } catch (err) {
          this._logger.error(`[TrustRisk] Error actualizando proyección ${projection.constructor.name}:`, err.message);
        }
      }
    }
  }
}

module.exports = { ProjectionDispatcher };
