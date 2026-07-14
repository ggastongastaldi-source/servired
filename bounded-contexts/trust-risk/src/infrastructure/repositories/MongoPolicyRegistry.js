'use strict';
const { IPolicyRegistry }     = require('../../domain/ports/IPolicyRegistry');
const { PolicyNotFoundError } = require('../../domain/errors');

class MongoPolicyRegistry extends IPolicyRegistry {
  constructor(db) { super(); this._col = db.collection('trust_policies'); this._cache = new Map(); }
  async ensureIndexes() {
    await this._col.createIndex({ version: 1 }, { unique: true });
    await this._col.createIndex({ deprecatedAt: 1 });
  }
  async seed() {
    const existing = await this._col.findOne({ version: 'policy-v1.0.0' });
    if (existing) return;
    await this._col.insertOne({
      version: 'policy-v1.0.0', effectiveFrom: new Date().toISOString(), deprecatedAt: null,
      dimensionWeights: { IDENTITY:0.25, DEVICE:0.15, BEHAVIOR:0.30, ECONOMIC:0.20, NETWORK:0.10 },
      requiredDimensions: ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'],
      minimumConfidenceForQuarantine: 0.30, minimumConfidenceForHardChallenge: 0.40,
      riskCaseThreshold: 35, signalCountThreshold: 3, assessmentTtlMs: 300_000,
      eventRules: {
        UserRegistered:   { dimension: 'IDENTITY',  delta: +5,  reason: 'usuario registrado' },
        LoginSucceeded:   [{ dimension: 'DEVICE', delta: +3, reason: 'login exitoso' }, { dimension: 'BEHAVIOR', delta: +2, reason: 'login exitoso' }],
        LoginFailed:      { dimension: 'DEVICE',    delta: -5,  reason: 'login fallido' },
        JobCreated:       { dimension: 'BEHAVIOR',  delta: +3,  reason: 'trabajo creado' },
        JobAccepted:      { dimension: 'BEHAVIOR',  delta: +5,  reason: 'trabajo aceptado' },
        JobCancelled:     { dimension: 'BEHAVIOR',  delta: -12, reason: 'trabajo cancelado' },
        PaymentCompleted: { dimension: 'ECONOMIC',  delta: +8,  reason: 'pago completado' },
        ReviewSubmitted:  [{ dimension: 'NETWORK', delta: +4, reason: 'resena enviada' }, { dimension: 'BEHAVIOR', delta: +3, reason: 'resena enviada' }],
      },
      createdAt: new Date(),
    });
  }
  async getActivePolicy() {
    if (this._cache.has('__active__')) return this._cache.get('__active__');
    const doc = await this._col.findOne({ deprecatedAt: null }, { sort: { effectiveFrom: -1 } });
    if (!doc) throw new PolicyNotFoundError('active');
    this._cache.set('__active__', doc);
    return doc;
  }
  async getByVersion(version) {
    if (this._cache.has(version)) return this._cache.get(version);
    const doc = await this._col.findOne({ version });
    if (!doc) throw new PolicyNotFoundError(version);
    this._cache.set(version, doc);
    return doc;
  }
  async getHistory() { return this._col.find({}).sort({ effectiveFrom: 1 }).toArray(); }
  invalidateCache() { this._cache.clear(); }
}
module.exports = { MongoPolicyRegistry };
