'use strict';
const { DomainEvent } = require('./DomainEvent');
class TrustProfileCreated extends DomainEvent {
  constructor({ trustProfileId, actorId, actorType, initialScore, policyVersion, occurredAt }) {
    super({ type: 'TrustProfileCreated', aggregateId: trustProfileId, aggregateType: 'TrustProfile', policyVersion, occurredAt });
    this.actorId      = actorId;
    this.actorType    = actorType;
    this.initialScore = initialScore;
    Object.freeze(this);
  }
  _payload() { return { actorId: this.actorId, actorType: this.actorType, initialScore: this.initialScore }; }
}
module.exports = { TrustProfileCreated };
