'use strict';
const { ITrustEventStore } = require('../../domain/ports/ITrustEventStore');
const { ConcurrencyError } = require('../../domain/errors');
const crypto = require('crypto');

class MongoTrustEventStore extends ITrustEventStore {
  constructor(db) { super(); this._col = db.collection('trust_events'); }
  async ensureIndexes() {
    await this._col.createIndex({ aggregateId: 1, sequence: 1 }, { unique: true, name: 'trust_events_aggregate_seq' });
    await this._col.createIndex({ eventType: 1, occurredAt: 1 });
    await this._col.createIndex({ occurredAt: 1 });
  }
  async append(aggregateId, events, expectedVersion) {
    if (!events.length) return;
    const current = await this.countEvents(aggregateId);
    if (current !== expectedVersion) throw new ConcurrencyError(aggregateId, expectedVersion, current);
    let prevHash = await this._lastHash(aggregateId);
    const docs = events.map((event, i) => {
      const sequence = expectedVersion + i + 1;
      const payload  = JSON.stringify(event);
      const hash     = crypto.createHash('sha256').update(`${prevHash}|${aggregateId}|${sequence}|${payload}`).digest('hex');
      prevHash = hash;
      return { aggregateId, aggregateType: event.aggregateType || 'Unknown', sequence, eventType: event.type, payload: event, policyVersion: event.policyVersion || null, occurredAt: event.occurredAt || new Date().toISOString(), hash, insertedAt: new Date() };
    });
    await this._col.insertMany(docs, { ordered: true });
  }
  async getStream(aggregateId, fromVersion = 0) {
    const docs = await this._col.find({ aggregateId, sequence: { $gt: fromVersion } }).sort({ sequence: 1 }).toArray();
    return docs.map(d => d.payload);
  }
  async getByTypes(eventTypes, fromDate) {
    const query = { eventType: { $in: eventTypes } };
    if (fromDate) query.occurredAt = { $gte: fromDate.toISOString() };
    return (await this._col.find(query).sort({ occurredAt: 1 }).toArray()).map(d => d.payload);
  }
  async countEvents(aggregateId) { return this._col.countDocuments({ aggregateId }); }
  async _lastHash(aggregateId) {
    const last = await this._col.findOne({ aggregateId }, { sort: { sequence: -1 }, projection: { hash: 1 } });
    return last ? last.hash : null;
  }
}
module.exports = { MongoTrustEventStore };
