'use strict';
const { IEconomicActorRepository } = require('../../domain/ports/IEconomicActorRepository');
const { EconomicActor }            = require('../../domain/aggregates/EconomicActor');

class MongoEconomicActorRepository extends IEconomicActorRepository {
  constructor(eventStore, db) {
    super();
    this._eventStore = eventStore;
    this._index      = db.collection('ei_actor_index');
  }

  async ensureIndexes() {
    await this._index.createIndex({ userId:  1 }, { unique: true });
    await this._index.createIndex({ actorId: 1 }, { unique: true });
  }

  async findById(actorId) {
    const events = await this._eventStore.getStream(actorId);
    if (!events.length) return null;
    return EconomicActor.rehydrate(events);
  }

  async findByUserId(userId) {
    const doc = await this._index.findOne({ userId });
    if (!doc) return null;
    return this.findById(doc.actorId);
  }

  async save(actor) {
    const events = actor.pullDomainEvents();
    if (!events.length) return;
    await this._eventStore.append(actor.id, events, actor.expectedVersion);
    if (events.some(e => e.type === 'EconomicActorCreated')) {
      await this._index.updateOne(
        { userId: actor.userId },
        { $set: { userId: actor.userId, actorId: actor.id, role: actor.role.value, createdAt: new Date() } },
        { upsert: true }
      );
    }
  }
}
module.exports = { MongoEconomicActorRepository };
