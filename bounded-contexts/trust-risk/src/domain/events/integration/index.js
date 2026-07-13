'use strict';
const { IntegrationEvent }     = require('./IntegrationEvent');
const { TrustScoreChanged }    = require('./TrustScoreChanged');
const { RiskDetected }         = require('./RiskDetected');
const { AccountQuarantined }   = require('./AccountQuarantined');
const { AccountRehabilitated } = require('./AccountRehabilitated');
const { IdentityVerified }     = require('./IdentityVerified');

module.exports = { IntegrationEvent, TrustScoreChanged, RiskDetected, AccountQuarantined, AccountRehabilitated, IdentityVerified };
