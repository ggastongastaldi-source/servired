'use strict';
const { DomainEvent } = require('./DomainEvent');
class TrustScoreConsolidated extends DomainEvent {
  constructor({ trustProfileId, scoreBefore, scoreAfter, riskLevel, policyVersion, occurredAt }) {
    super({ type: 'TrustScoreConsolidated', aggregateId: trustProfileId, aggregateType: 'TrustProfile', policyVersion, occurredAt });
    this.scoreBefore = scoreBefore;
    this.scoreAfter  = scoreAfter;
    this.riskLevel   = riskLevel;
    Object.freeze(this);
  }
  _payload() { return { scoreBefore: this.scoreBefore, scoreAfter: this.scoreAfter, riskLevel: this.riskLevel }; }
}
module.exports = { TrustScoreConsolidated };
