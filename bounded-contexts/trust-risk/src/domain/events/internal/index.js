'use strict';
const { DomainEvent }           = require('./DomainEvent');
const { TrustProfileCreated }   = require('./TrustProfileCreated');
const { DimensionScoreUpdated } = require('./DimensionScoreUpdated');
const { TrustScoreConsolidated }= require('./TrustScoreConsolidated');
const { ProfileStatusChanged }  = require('./ProfileStatusChanged');
const { RiskCaseOpened }        = require('./RiskCaseOpened');
const { RiskCaseResolved }      = require('./RiskCaseResolved');

module.exports = { DomainEvent, TrustProfileCreated, DimensionScoreUpdated, TrustScoreConsolidated, ProfileStatusChanged, RiskCaseOpened, RiskCaseResolved };
