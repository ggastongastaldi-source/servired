'use strict';
const { IntegrationEvent } = require('./IntegrationEvent');
class AccountQuarantined extends IntegrationEvent {
  constructor({ actorId, actorType, reason, effectiveAt }) {
    super({ type: 'AccountQuarantined', actorId, actorType, occurredAt: effectiveAt });
    this.reason      = reason;
    this.effectiveAt = effectiveAt;
    Object.freeze(this);
  }
  _payload() { return { reason: this.reason, effectiveAt: this.effectiveAt }; }
}
module.exports = { AccountQuarantined };
