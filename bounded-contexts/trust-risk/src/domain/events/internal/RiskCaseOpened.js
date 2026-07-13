'use strict';
const { DomainEvent } = require('./DomainEvent');
class RiskCaseOpened extends DomainEvent {
  constructor({ riskCaseId, trustProfileId, severity, triggeredBy, policyVersion, occurredAt }) {
    super({ type: 'RiskCaseOpened', aggregateId: riskCaseId, aggregateType: 'RiskCase', policyVersion, occurredAt });
    this.trustProfileId = trustProfileId;
    this.severity       = severity;
    this.triggeredBy    = triggeredBy || [];
    Object.freeze(this);
  }
  _payload() { return { trustProfileId: this.trustProfileId, severity: this.severity, triggeredBy: this.triggeredBy }; }
}
module.exports = { RiskCaseOpened };
