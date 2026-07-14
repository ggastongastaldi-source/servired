'use strict';

/**
 * RiskDashboardProjection — visión operativa para GIA y admin.
 *
 * ADR-006: GIA consume esta proyección para análisis y recomendaciones.
 * ADR-007: proyección derivada — reconstruible desde el Event Store.
 */
class RiskDashboardProjection {

  constructor(db) {
    this._col = db.collection('proj_risk_dashboard');
  }

  async ensureIndexes() {
    await this._col.createIndex({ type: 1 }, { unique: true });
  }

  async getSummary() {
    const doc = await this._col.findOne({ type: 'summary' });
    return doc || this._emptySummary();
  }

  async onRiskCaseOpened(event) {
    await this._col.updateOne(
      { type: 'summary' },
      { $inc: { openCases: 1 }, $set: { updatedAt: event.occurredAt } },
      { upsert: true }
    );
  }

  async onRiskCaseResolved(event) {
    await this._col.updateOne(
      { type: 'summary' },
      { $inc: { openCases: -1, resolvedCases: 1 }, $set: { updatedAt: event.occurredAt } },
      { upsert: true }
    );
  }

  async onProfileStatusChanged(event) {
    const delta = {};
    if (event.newStatus === 'QUARANTINED')    delta.$inc = { quarantinedActors: 1 };
    if (event.previousStatus === 'QUARANTINED') {
      delta.$inc = { ...(delta.$inc || {}), quarantinedActors: -1 };
    }
    if (Object.keys(delta).length) {
      delta.$set = { updatedAt: event.occurredAt };
      await this._col.updateOne({ type: 'summary' }, delta, { upsert: true });
    }
  }

  async apply(event) {
    switch (event.type) {
      case 'RiskCaseOpened':       return this.onRiskCaseOpened(event);
      case 'RiskCaseResolved':     return this.onRiskCaseResolved(event);
      case 'ProfileStatusChanged': return this.onProfileStatusChanged(event);
    }
  }

  _emptySummary() {
    return { openCases: 0, resolvedCases: 0, quarantinedActors: 0 };
  }
}

module.exports = { RiskDashboardProjection };
