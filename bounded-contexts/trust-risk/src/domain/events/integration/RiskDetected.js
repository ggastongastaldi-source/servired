'use strict';
const { IntegrationEvent } = require('./IntegrationEvent');
class RiskDetected extends IntegrationEvent {
  constructor({ actorId, actorType, severity, recommendedFriction, occurredAt }) {
    super({ type: 'RiskDetected', actorId, actorType, occurredAt });
    this.severity            = severity;
    this.recommendedFriction = recommendedFriction;
    Object.freeze(this);
  }
  _payload() { return { severity: this.severity, recommendedFriction: this.recommendedFriction }; }
}
module.exports = { RiskDetected };
