'use strict';

/**
 * TrustScoreProjection — proyección materializada para lectura rápida.
 *
 * Consumida por: DIXIE, Dispatch, UI.
 * ADR-005: DIXIE solo lee esta proyección — nunca el agregado.
 * ADR-007: Si hay discrepancia con el Event Store, el Event Store gana.
 *
 * Se actualiza en respuesta a:
 *   TrustScoreConsolidated | ProfileStatusChanged | TrustProfileCreated
 */
class TrustScoreProjection {

  constructor(db) {
    this._col = db.collection('proj_trust_scores');
  }

  async ensureIndexes() {
    await this._col.createIndex({ actorId: 1 }, { unique: true });
    await this._col.createIndex({ riskLevel: 1 });
    await this._col.createIndex({ status: 1 });
    await this._col.createIndex({ updatedAt: -1 });
  }

  async findByActorId(actorId) {
    return this._col.findOne({ actorId }) || null;
  }

  async findByTrustProfileId(trustProfileId) {
    return this._col.findOne({ trustProfileId }) || null;
  }

  // ── Handlers de eventos de dominio ────────────────────────────────────────

  async onTrustProfileCreated(event) {
    await this._col.updateOne(
      { trustProfileId: event.aggregateId },
      { $set: {
        trustProfileId:     event.aggregateId,
        actorId:            event.actorId,
        actorType:          event.actorType,
        score:              event.initialScore,
        riskLevel:          'MEDIUM',
        status:             'ACTIVE',
        confidence:         0,
        recommendedFriction:'NONE',
        policyVersion:      event.policyVersion,
        updatedAt:          event.occurredAt,
        createdAt:          event.occurredAt,
      }},
      { upsert: true }
    );
  }

  async onTrustScoreConsolidated(event) {
    const friction = this._frictionFromRisk(event.riskLevel);
    await this._col.updateOne(
      { trustProfileId: event.aggregateId },
      { $set: {
        score:              event.scoreAfter,
        riskLevel:          event.riskLevel,
        recommendedFriction: friction,
        policyVersion:      event.policyVersion,
        updatedAt:          event.occurredAt,
      }}
    );
  }

  async onProfileStatusChanged(event) {
    await this._col.updateOne(
      { trustProfileId: event.aggregateId },
      { $set: {
        status:    event.newStatus,
        updatedAt: event.occurredAt,
      }}
    );
  }

  _frictionFromRisk(riskLevel) {
    switch (riskLevel) {
      case 'CRITICAL': return 'MANUAL_REVIEW';
      case 'HIGH':     return 'HARD_CHALLENGE';
      case 'MEDIUM':   return 'SOFT_CHALLENGE';
      default:         return 'NONE';
    }
  }

  /**
   * Dispatcher: recibe cualquier evento de dominio y actualiza la proyección.
   */
  async apply(event) {
    switch (event.type) {
      case 'TrustProfileCreated':    return this.onTrustProfileCreated(event);
      case 'TrustScoreConsolidated': return this.onTrustScoreConsolidated(event);
      case 'ProfileStatusChanged':   return this.onProfileStatusChanged(event);
    }
  }
}

module.exports = { TrustScoreProjection };
