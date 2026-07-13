'use strict';
const { DomainEvent } = require('./DomainEvent');
class RiskCaseResolved extends DomainEvent {
  constructor({ riskCaseId, trustProfileId, resolution, occurredAt }) {
    super({ type: 'RiskCaseResolved', aggregateId: riskCaseId, aggregateType: 'RiskCase', occurredAt });
    this.trustProfileId = trustProfileId;
    this.resolution     = resolution;
    Object.freeze(this);
  }
  _payload() { return { trustProfileId: this.trustProfileId, resolution: this.resolution }; }
}
module.exports = { RiskCaseResolved };
