'use strict';
const { IntegrationEvent } = require('./IntegrationEvent');
class TrustScoreChanged extends IntegrationEvent {
  constructor({ actorId, actorType, newScore, riskLevel, occurredAt }) {
    super({ type: 'TrustScoreChanged', actorId, actorType, occurredAt });
    this.newScore  = newScore;
    this.riskLevel = riskLevel;
    Object.freeze(this);
  }
  _payload() { return { newScore: this.newScore, riskLevel: this.riskLevel }; }
}
module.exports = { TrustScoreChanged };
