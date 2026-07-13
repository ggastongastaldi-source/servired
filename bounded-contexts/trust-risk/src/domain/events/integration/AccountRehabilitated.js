'use strict';
const { IntegrationEvent } = require('./IntegrationEvent');
class AccountRehabilitated extends IntegrationEvent {
  constructor({ actorId, actorType, newScore, effectiveAt }) {
    super({ type: 'AccountRehabilitated', actorId, actorType, occurredAt: effectiveAt });
    this.newScore    = newScore;
    this.effectiveAt = effectiveAt;
    Object.freeze(this);
  }
  _payload() { return { newScore: this.newScore, effectiveAt: this.effectiveAt }; }
}
module.exports = { AccountRehabilitated };
