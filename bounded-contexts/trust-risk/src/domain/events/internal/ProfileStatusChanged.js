'use strict';
const { DomainEvent } = require('./DomainEvent');
class ProfileStatusChanged extends DomainEvent {
  constructor({ trustProfileId, previousStatus, newStatus, reason, occurredAt }) {
    super({ type: 'ProfileStatusChanged', aggregateId: trustProfileId, aggregateType: 'TrustProfile', occurredAt });
    this.previousStatus = previousStatus;
    this.newStatus      = newStatus;
    this.reason         = reason || null;
    Object.freeze(this);
  }
  _payload() { return { previousStatus: this.previousStatus, newStatus: this.newStatus, reason: this.reason }; }
}
module.exports = { ProfileStatusChanged };
