'use strict';
/**
 * MongoEventStore — Event Store append-only por bounded context.
 * ADR-007: sin UPDATE ni DELETE sobre eventos.
 * Optimistic locking por expectedVersion.
 */
class MongoEventStore {
  constructor(db, collectionName) {
    this._col = db.collection(collectionName);
  }

  async ensureIndexes() {
    await this._col.createIndex({ aggregateId: 1, version: 1 }, { unique: true });
    await this._col.createIndex({ aggregateId: 1, occurredAt: 1 });
    await this._col.createIndex({ type: 1, occurredAt: -1 });
  }

  async append(aggregateId, events, expectedVersion) {
    const docs = events.map((event, i) => ({
      ...event,
      aggregateId,
      version:    expectedVersion + i + 1,
      insertedAt: new Date(),
    }));
    try {
      await this._col.insertMany(docs, { ordered: true });
    } catch (err) {
      if (err.code === 11000)
        throw new Error(`Optimistic locking: versión ${expectedVersion} ya existe para ${aggregateId}`);
      throw err;
    }
  }

  async getStream(aggregateId) {
    return this._col
      .find({ aggregateId })
      .sort({ version: 1 })
      .toArray();
  }

  async getStreamFrom(aggregateId, fromVersion) {
    return this._col
      .find({ aggregateId, version: { $gt: fromVersion } })
      .sort({ version: 1 })
      .toArray();
  }

  async getByType(type, limit = 100) {
    return this._col
      .find({ type })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .toArray();
  }
}

module.exports = { MongoEventStore };
