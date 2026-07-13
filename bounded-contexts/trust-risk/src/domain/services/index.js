'use strict';
const { TrustScoreCalculator } = require('./TrustScoreCalculator');
const { EvidenceCollector }    = require('./EvidenceCollector');
const { ExplanationBuilder }   = require('./ExplanationBuilder');
const { RiskEvaluator }        = require('./RiskEvaluator');
const { FrictionAdapter }      = require('./FrictionAdapter');

module.exports = { TrustScoreCalculator, EvidenceCollector, ExplanationBuilder, RiskEvaluator, FrictionAdapter };
