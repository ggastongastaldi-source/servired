'use strict';

class DomainEvent {
  constructor({ type, aggregateId, aggregateType, policyVersion, occurredAt }) {
    if (!type)        throw new Error('DomainEvent requires type');
    if (!aggregateId) throw new Error('DomainEvent requires aggregateId');
    this.type          = type;
    this.aggregateId   = aggregateId;
    this.aggregateType = aggregateType || null;
    this.policyVersion = policyVersion || null;
    this.occurredAt    = occurredAt || new Date().toISOString();
    this.eventId       = `evt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }
  toJSON() {
    return { eventId: this.eventId, type: this.type, aggregateId: this.aggregateId, aggregateType: this.aggregateType, policyVersion: this.policyVersion, occurredAt: this.occurredAt, ...this._payload() };
  }
  _payload() { return {}; }
}

module.exports = { DomainEvent };
