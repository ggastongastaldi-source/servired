'use strict';
class SnapshotStore {
  constructor(db, snapshotEvery = 50) { this._col = db.collection('trust_snapshots'); this._snapshotEvery = snapshotEvery; }
  async ensureIndexes() { await this._col.createIndex({ aggregateId: 1, version: -1 }); }
  async findLatest(aggregateId) { return null; }
  async saveIfNeeded(aggregateId, version, state) {
    if (version % this._snapshotEvery !== 0) return;
    await this._col.updateOne({ aggregateId, version }, { $set: { aggregateId, version, state, savedAt: new Date() } }, { upsert: true });
  }
}
module.exports = { SnapshotStore };
