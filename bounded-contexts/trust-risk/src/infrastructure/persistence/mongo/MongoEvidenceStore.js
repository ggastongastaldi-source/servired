'use strict';
const { IEvidenceStore } = require('../../../domain/ports/IEvidenceStore');

class MongoEvidenceStore extends IEvidenceStore {
  constructor(db) { super(); this._col = db.collection('trust_evidence'); }
  async ensureIndexes() {
    await this._col.createIndex({ trustProfileId: 1, appliedAt: -1 });
    await this._col.createIndex({ evidenceId: 1 }, { unique: true });
  }
  async append(evidence) { await this._col.insertOne({ ...evidence, insertedAt: new Date() }); }
  async getHistory(trustProfileId, from, to) {
    const q = { trustProfileId };
    if (from || to) { q.appliedAt = {}; if (from) q.appliedAt.$gte = from.toISOString(); if (to) q.appliedAt.$lte = to.toISOString(); }
    return this._col.find(q).sort({ appliedAt: 1 }).toArray();
  }
  async getRecent(trustProfileId, limit = 20) {
    return this._col.find({ trustProfileId }).sort({ appliedAt: -1 }).limit(limit).toArray();
  }
}
module.exports = { MongoEvidenceStore };
