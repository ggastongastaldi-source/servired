'use strict';
const { IExplanationStore } = require('../../../domain/ports/IExplanationStore');

class MongoExplanationStore extends IExplanationStore {
  constructor(db) { super(); this._col = db.collection('trust_explanations'); }
  async ensureIndexes() {
    await this._col.createIndex({ trustProfileId: 1, timestamp: -1 });
    await this._col.createIndex({ evidenceId: 1 }, { unique: true });
    await this._col.createIndex({ explanationId: 1 }, { unique: true });
  }
  async append(explanation) { await this._col.insertOne({ ...explanation, insertedAt: new Date() }); }
  async getByProfile(trustProfileId, limit = 50) {
    return this._col.find({ trustProfileId }).sort({ timestamp: -1 }).limit(limit).toArray();
  }
  async getByEvidenceId(evidenceId) { return this._col.findOne({ evidenceId }) || null; }
}
module.exports = { MongoExplanationStore };
