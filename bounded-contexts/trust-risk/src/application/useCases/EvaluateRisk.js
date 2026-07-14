'use strict';

const { TrustProfileNotFoundError } = require('../../domain/errors');
const { RiskEvaluator }             = require('../../domain/services/RiskEvaluator');
const { FrictionAdapter }           = require('../../domain/services/FrictionAdapter');
const { RiskCase }                  = require('../../domain/aggregates/RiskCase');
const { RiskLevel }                 = require('../../domain/valueObjects/RiskLevel');
const { RiskDetected }              = require('../../domain/events/integration/RiskDetected');

/**
 * EvaluateRisk — Use Case
 *
 * Evalúa el riesgo actual de un actor y decide si abrir un RiskCase.
 * ADR-002: no modifica TrustProfile — solo lee y evalúa.
 */
class EvaluateRisk {

  constructor({ unitOfWork, policyRegistry, clock, idGenerator }) {
    this._uow            = unitOfWork;
    this._policyRegistry = policyRegistry;
    this._clock          = clock;
    this._idGenerator    = idGenerator;
    this._evaluator      = new RiskEvaluator();
    this._friction       = new FrictionAdapter();
  }

  async execute({ actorId }) {
    const profile = await this._uow.trustProfiles.findByActorId(actorId);
    if (!profile) throw new TrustProfileNotFoundError(actorId);

    const policy       = await this._policyRegistry.getActivePolicy();
    const openCases    = await this._uow.riskCases.findOpenByProfileId(profile.id);
    const assessment   = this._evaluator.evaluate(profile, [], policy);
    const friction     = this._friction.recommend(
      RiskLevel.of(assessment.riskLevel),
      profile.confidence.value,
      policy
    );

    if (!assessment.shouldOpenCase) {
      return { actorId, riskLevel: assessment.riskLevel, shouldOpenCase: false, friction: friction.level };
    }

    // Ya tiene un caso abierto — no duplicar
    if (openCases.length > 0) {
      return { actorId, riskLevel: assessment.riskLevel, shouldOpenCase: false, existingCase: openCases[0].id, friction: friction.level };
    }

    const riskCase = RiskCase.open({
      riskCaseId:    this._idGenerator(),
      trustProfileId: profile.id,
      severity:      RiskLevel.of(assessment.severity),
      triggeredBy:   [],
      policyVersion: policy.version,
      clock:         this._clock,
    });

    await this._uow.riskCases.save(riskCase);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([
      new RiskDetected({
        actorId,
        actorType:           profile.actorType,
        severity:            assessment.severity,
        recommendedFriction: friction.level,
        occurredAt:          this._clock.now().toISOString(),
      }),
    ]);

    await this._uow.publish();

    return { actorId, riskLevel: assessment.riskLevel, shouldOpenCase: true, riskCaseId: riskCase.id, friction: friction.level };
  }
}

module.exports = { EvaluateRisk };
