'use strict';
const { IntegrationEvent } = require('./IntegrationEvent');
class IdentityVerified extends IntegrationEvent {
  constructor({ actorId, actorType, method, verifiedAt }) {
    super({ type: 'IdentityVerified', actorId, actorType, occurredAt: verifiedAt });
    this.method     = method;
    this.verifiedAt = verifiedAt;
    Object.freeze(this);
  }
  _payload() { return { method: this.method, verifiedAt: this.verifiedAt }; }
}
module.exports = { IdentityVerified };
