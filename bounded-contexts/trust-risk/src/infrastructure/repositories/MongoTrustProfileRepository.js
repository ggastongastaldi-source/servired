'use strict';

const { ITrustProfileRepository } = require('../../domain/ports/ITrustProfileRepository');
const { TrustProfile }            = require('../../domain/aggregates/TrustProfile');

/**
 * MongoTrustProfileRepository
 * Reconstruye TrustProfile haciendo replay del Event Store.
 * ADR-007: El estado se deriva de eventos, nunca de un documento de estado.
 *
 * Snapshot opcional: si existe snapshot reciente, hace replay solo
 * desde ese punto (optimización — no implementada en v1, stub preparado).
 */
class MongoTrustProfileRepository extends ITrustProfileRepository {

  constructor(eventStore, db) {
    super();
    this._eventStore = eventStore;
    this._index      = db.collection('trust_profile_index');
  }

  async ensureIndexes() {
    await this._index.createIndex({ actorId: 1 }, { unique: true, name: 'trust_profile_actor_idx' });
    await this._index.createIndex({ trustProfileId: 1 }, { unique: true, name: 'trust_profile_id_idx' });
  }

  async findById(trustProfileId) {
    const events = await this._eventStore.getStream(trustProfileId);
    if (!events.length) return null;
    return TrustProfile.rehydrate(events);
  }

  async findByActorId(actorId) {
    const doc = await this._index.findOne({ actorId });
    if (!doc) return null;
    return this.findById(doc.trustProfileId);
  }

  async save(trustProfile) {
    const events = trustProfile.pullDomainEvents();
    if (!events.length) return;

    await this._eventStore.append(
      trustProfile.id,
      events,
      trustProfile.expectedVersion
    );

    // Mantener índice actorId → trustProfileId para búsquedas rápidas
    if (events.some(e => e.type === 'TrustProfileCreated')) {
      await this._index.updateOne(
        { actorId: trustProfile.actorId },
        { $set: { actorId: trustProfile.actorId, trustProfileId: trustProfile.id, createdAt: new Date() } },
        { upsert: true }
      );
    }
  }
}

module.exports = { MongoTrustProfileRepository };
