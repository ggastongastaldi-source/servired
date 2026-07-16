'use strict';
const { ITerritorialCycleRepository } = require('../../domain/ports/ITerritorialCycleRepository');
const { TerritorialCycle }            = require('../../domain/aggregates/TerritorialCycle');

class MongoTerritorialCycleRepository extends ITerritorialCycleRepository {
  constructor(eventStore, db) {
    super();
    this._eventStore = eventStore;
    this._index      = db.collection('co_cycle_index');
  }

  async ensureIndexes() {
    await this._index.createIndex({ cycleId:  1 }, { unique: true });
    await this._index.createIndex({ zonaId:   1, status: 1 });
    await this._index.createIndex({ rubroId:  1 });
    await this._index.createIndex({ status:   1 });
    await this._index.createIndex({ startedAt: -1 });
  }

  async findById(cycleId) {
    const events = await this._eventStore.getStream(cycleId);
    if (!events.length) return null;
    return TerritorialCycle.rehydrate(events);
  }

  async findByZona(zonaId, limit = 20) {
    const docs = await this._index.find({ zonaId }).sort({ startedAt: -1 }).limit(limit).toArray();
    return Promise.all(docs.map(d => this.findById(d.cycleId)));
  }

  async findActive() {
    const docs = await this._index.find({
      status: { $nin: ['COMPLETED','CANCELLED'] }
    }).toArray();
    return Promise.all(docs.map(d => this.findById(d.cycleId)));
  }

  async save(cycle) {
    const events = cycle.pullDomainEvents();
    if (!events.length) return;
    await this._eventStore.append(cycle.id, events, cycle.expectedVersion);
    await this._index.updateOne(
      { cycleId: cycle.id },
      { $set: { cycleId: cycle.id, zonaId: cycle.zonaId, rubroId: cycle.rubroId,
                status: cycle.status.value,
                startedAt: cycle._startedAt, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}
module.exports = { MongoTerritorialCycleRepository };
