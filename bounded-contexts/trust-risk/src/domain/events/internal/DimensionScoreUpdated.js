'use strict';
const { DomainEvent } = require('./DomainEvent');
class DimensionScoreUpdated extends DomainEvent {
  constructor({ trustProfileId, dimension, scoreBefore, scoreAfter, delta, evidenceId, policyVersion, occurredAt }) {
    super({ type: 'DimensionScoreUpdated', aggregateId: trustProfileId, aggregateType: 'TrustProfile', policyVersion, occurredAt });
    this.dimension   = dimension;
    this.scoreBefore = scoreBefore;
    this.scoreAfter  = scoreAfter;
    this.delta       = delta;
    this.evidenceId  = evidenceId;
    Object.freeze(this);
  }
  _payload() { return { dimension: this.dimension, scoreBefore: this.scoreBefore, scoreAfter: this.scoreAfter, delta: this.delta, evidenceId: this.evidenceId }; }
}
module.exports = { DimensionScoreUpdated };
