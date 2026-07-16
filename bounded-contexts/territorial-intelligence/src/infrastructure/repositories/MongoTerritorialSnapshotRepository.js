'use strict';
const { ITerritorialSnapshotRepository } = require('../../domain/ports/ITerritorialSnapshotRepository');
const { TerritorialSnapshot }            = require('../../domain/aggregates/TerritorialSnapshot');

class MongoTerritorialSnapshotRepository extends ITerritorialSnapshotRepository {
  constructor(eventStore, db) {
    super();
    this._eventStore = eventStore;
    this._index      = db.collection('ti_snapshot_index');
  }

  async ensureIndexes() {
    await this._index.createIndex({ zonaId:     1 }, { unique: true });
    await this._index.createIndex({ snapshotId: 1 }, { unique: true });
    await this._index.createIndex({ health:     1 });
  }

  async findByZona(zonaId) {
    const doc = await this._index.findOne({ zonaId });
    if (!doc) return null;
    return this.findById(doc.snapshotId);
  }

  async findById(snapshotId) {
    const events = await this._eventStore.getStream(snapshotId);
    if (!events.length) return null;
    return TerritorialSnapshot.rehydrate(events);
  }

  async save(snapshot) {
    const events = snapshot.pullDomainEvents();
    if (!events.length) return;
    await this._eventStore.append(snapshot.id, events, snapshot.expectedVersion);
    await this._index.updateOne(
      { zonaId: snapshot.zonaId },
      { $set: { zonaId: snapshot.zonaId, snapshotId: snapshot.id,
                health: snapshot.health.value,
                activeOffers: snapshot.activeOffers, activeNodes: snapshot.activeNodes,
                cyclesCompleted: snapshot.cyclesCompleted, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}
module.exports = { MongoTerritorialSnapshotRepository };
