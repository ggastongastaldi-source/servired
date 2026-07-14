'use strict';
const { IRiskCaseRepository } = require('../../domain/ports/IRiskCaseRepository');
const { RiskCase }            = require('../../domain/aggregates/RiskCase');

class MongoRiskCaseRepository extends IRiskCaseRepository {
  constructor(eventStore, db) { super(); this._eventStore = eventStore; this._index = db.collection('risk_case_index'); }
  async ensureIndexes() {
    await this._index.createIndex({ riskCaseId: 1 }, { unique: true });
    await this._index.createIndex({ trustProfileId: 1 });
    await this._index.createIndex({ status: 1 });
  }
  async findById(riskCaseId) {
    const events = await this._eventStore.getStream(riskCaseId);
    if (!events.length) return null;
    return RiskCase.rehydrate(events);
  }
  async findOpenByProfileId(trustProfileId) {
    const docs = await this._index.find({ trustProfileId, status: { $in: ['OPEN','INVESTIGATING'] } }).toArray();
    const cases = await Promise.all(docs.map(d => this.findById(d.riskCaseId)));
    return cases.filter(Boolean);
  }
  async save(riskCase) {
    const events = riskCase.pullDomainEvents();
    if (!events.length) return;
    await this._eventStore.append(riskCase.id, events, riskCase.expectedVersion);
    await this._index.updateOne(
      { riskCaseId: riskCase.id },
      { $set: { riskCaseId: riskCase.id, trustProfileId: riskCase.trustProfileId, status: riskCase.status, severity: riskCase.severity?.value || null, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}
module.exports = { MongoRiskCaseRepository };
