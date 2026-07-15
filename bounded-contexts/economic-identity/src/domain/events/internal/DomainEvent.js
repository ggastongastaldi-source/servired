'use strict';
const crypto = require('crypto');
class DomainEvent {
  constructor({ type, aggregateId, aggregateType, occurredAt }) {
    if (!type)        throw new Error('DomainEvent requires type');
    if (!aggregateId) throw new Error('DomainEvent requires aggregateId');
    this.type          = type;
    this.aggregateId   = aggregateId;
    this.aggregateType = aggregateType || 'EconomicActor';
    this.occurredAt    = occurredAt || new Date().toISOString();
    this.eventId       = crypto.randomUUID();
  }
  toJSON() {
    return { eventId: this.eventId, type: this.type, aggregateId: this.aggregateId,
             aggregateType: this.aggregateType, occurredAt: this.occurredAt, ...this._payload() };
  }
  _payload() { return {}; }
}
module.exports = { DomainEvent };
