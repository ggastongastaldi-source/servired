'use strict';

const { IEvidenceStore } = require('../../../domain/ports/IEvidenceStore');

/**
 * MongoEvidenceStore — colección append-only de TrustEvidence.
 * ADR-007: sin UPDATE ni DELETE.
 */
class MongoEvidenceStore extends IEvidenceStore {

  constructor(db) {
    super();
    this._col = db.collection('trust_evidence');
  }

  async ensureIndexes() {
    await this._col.createIndex({ trustProfileId: 1, appliedAt: -1 });
    await this._col.createIndex({ evidenceId: 1 }, { unique: true });
    await this._col.createIndex({ sourceEventId: 1 });
  }

  async append(evidence) {
    await this._col.insertOne({
      ...evidence,
      insertedAt: new Date(),
    });
  }

  async getHistory(trustProfileId, from, to) {
    const query = { trustProfileId };
    if (from || to) {
      query.appliedAt = {};
      if (from) query.appliedAt.$gte = from.toISOString();
      if (to)   query.appliedAt.$lte = to.toISOString();
    }
    return this._col.find(query).sort({ appliedAt: 1 }).toArray();
  }

  async getRecent(trustProfileId, limit = 20) {
    return this._col
      .find({ trustProfileId })
      .sort({ appliedAt: -1 })
      .limit(limit)
      .toArray();
  }
}

module.exports = { MongoEvidenceStore };
