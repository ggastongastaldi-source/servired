'use strict';
const { ITrustProfileRepository } = require('../../domain/ports/ITrustProfileRepository');
const { TrustProfile }            = require('../../domain/aggregates/TrustProfile');

class MongoTrustProfileRepository extends ITrustProfileRepository {
  constructor(eventStore, db) { super(); this._eventStore = eventStore; this._index = db.collection('trust_profile_index'); }
  async ensureIndexes() {
    await this._index.createIndex({ actorId: 1 }, { unique: true });
    await this._index.createIndex({ trustProfileId: 1 }, { unique: true });
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
    await this._eventStore.append(trustProfile.id, events, trustProfile.expectedVersion);
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
