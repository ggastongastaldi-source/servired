'use strict';
const { IOperationalAssessmentStore } = require('../../../domain/ports/IOperationalAssessmentStore');
const { AssessmentExpiredError }      = require('../../../domain/errors');

class MongoOperationalAssessmentStore extends IOperationalAssessmentStore {
  constructor(db) { super(); this._col = db.collection('trust_operational_assessments'); }
  async ensureIndexes() {
    await this._col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'trust_assessment_ttl' });
    await this._col.createIndex({ assessmentId: 1 }, { unique: true });
    await this._col.createIndex({ operationId: 1 });
    await this._col.createIndex({ actorId: 1, status: 1 });
  }
  async save(assessment) {
    const snap = assessment.toSnapshot ? assessment.toSnapshot() : assessment;
    await this._col.updateOne({ assessmentId: snap.assessmentId }, { $set: { ...snap, savedAt: new Date() } }, { upsert: true });
  }
  async findById(assessmentId) {
    const doc = await this._col.findOne({ assessmentId });
    if (!doc) return null;
    if (doc.status === 'EXPIRED') throw new AssessmentExpiredError(assessmentId);
    return doc;
  }
  async markConsumed(assessmentId) {
    const r = await this._col.updateOne({ assessmentId, status: 'ASSESSED' }, { $set: { status: 'CONSUMED', consumedAt: new Date() } });
    if (!r.matchedCount) throw new AssessmentExpiredError(assessmentId);
  }
  async findByOperationId(operationId) {
    return this._col.findOne({ operationId, status: { $in: ['PENDING','ASSESSED'] } }, { sort: { savedAt: -1 } }) || null;
  }
}
module.exports = { MongoOperationalAssessmentStore };
