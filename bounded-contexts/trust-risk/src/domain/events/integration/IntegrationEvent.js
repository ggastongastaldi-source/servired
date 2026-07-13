'use strict';

class IntegrationEvent {
  constructor({ type, actorId, actorType, occurredAt }) {
    if (!type)    throw new Error('IntegrationEvent requires type');
    if (!actorId) throw new Error('IntegrationEvent requires actorId');
    this.type       = type;
    this.actorId    = actorId;
    this.actorType  = actorType || null;
    this.occurredAt = occurredAt || new Date().toISOString();
    this.eventId    = `int_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }
  toJSON() {
    return { eventId: this.eventId, type: this.type, actorId: this.actorId, actorType: this.actorType, occurredAt: this.occurredAt, ...this._payload() };
  }
  _payload() { return {}; }
}

module.exports = { IntegrationEvent };
