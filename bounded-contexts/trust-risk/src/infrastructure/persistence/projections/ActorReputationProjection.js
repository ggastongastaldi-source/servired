'use strict';

/**
 * ActorReputationProjection — proyección pública del ecosistema.
 *
 * Solo expone la banda (FULL|HIGH|MEDIUM|LOW|CRITICAL), nunca el score exacto.
 * Consumida por otros actores del ecosistema para decisiones de confianza mutua.
 */
class ActorReputationProjection {

  constructor(db) {
    this._col = db.collection('proj_actor_reputation');
  }

  async ensureIndexes() {
    await this._col.createIndex({ actorId: 1 }, { unique: true });
    await this._col.createIndex({ scoreBand: 1 });
    await this._col.createIndex({ actorType: 1 });
  }

  async findByActorId(actorId) {
    return this._col.findOne({ actorId }, { projection: { _id: 0, actorId: 1, scoreBand: 1, actorType: 1, updatedAt: 1 } }) || null;
  }

  async onTrustProfileCreated(event) {
    await this._col.updateOne(
      { actorId: event.actorId },
      { $set: {
        actorId:   event.actorId,
        actorType: event.actorType,
        scoreBand: 'MEDIUM',
        updatedAt: event.occurredAt,
      }},
      { upsert: true }
    );
  }

  async onTrustScoreConsolidated(event) {
    const band = this._scoreToBand(event.scoreAfter);
    await this._col.updateOne(
      { trustProfileId: event.aggregateId },
      { $set: { scoreBand: band, updatedAt: event.occurredAt } }
    );
  }

  _scoreToBand(score) {
    if (score >= 80) return 'FULL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'CRITICAL';
  }

  async apply(event) {
    switch (event.type) {
      case 'TrustProfileCreated':    return this.onTrustProfileCreated(event);
      case 'TrustScoreConsolidated': return this.onTrustScoreConsolidated(event);
    }
  }
}

module.exports = { ActorReputationProjection };
