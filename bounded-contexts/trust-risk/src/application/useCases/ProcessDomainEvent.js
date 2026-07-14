'use strict';

const { TrustProfileNotFoundError } = require('../../domain/errors');
const { EvidenceCollector }         = require('../../domain/services/EvidenceCollector');
const { ExplanationBuilder }        = require('../../domain/services/ExplanationBuilder');
const { TrustScoreChanged }         = require('../../domain/events/integration/TrustScoreChanged');

/**
 * ProcessDomainEvent — Use Case
 *
 * Procesa un evento entrante desde SINAPSIS y actualiza el TrustProfile.
 *
 * Patrón:
 *   1. EvidenceCollector traduce el evento a impactos por dimensión
 *   2. Por cada impacto: applyEvidence() en el TrustProfile
 *   3. recalculateScore()
 *   4. ExplanationBuilder genera explicación estructurada
 *   5. Persiste todo
 *   6. Publica TrustScoreChanged si el score cambió
 */
class ProcessDomainEvent {

  constructor({ unitOfWork, policyRegistry, evidenceStore, explanationStore, clock, idGenerator }) {
    this._uow              = unitOfWork;
    this._policyRegistry   = policyRegistry;
    this._evidenceStore    = evidenceStore;
    this._explanationStore = explanationStore;
    this._clock            = clock;
    this._idGenerator      = idGenerator;
    this._collector        = new EvidenceCollector();
    this._explainer        = new ExplanationBuilder();
  }

  async execute({ actorId, incomingEvent }) {
    const profile = await this._uow.trustProfiles.findByActorId(actorId);
    if (!profile) throw new TrustProfileNotFoundError(actorId);

    const policy  = await this._policyRegistry.getActivePolicy();
    const impacts = this._collector.collect(incomingEvent, policy);

    if (!impacts.length) return { processed: false, reason: 'no_rule' };

    const scoreBefore = profile.score.value;

    for (const impact of impacts) {
      const evidenceId = this._idGenerator();

      profile.applyEvidence({
        dimension:     impact.dimension,
        delta:         impact.delta,
        evidenceId,
        policyVersion: policy.version,
        clock:         this._clock,
      });

      const evidence = {
        evidenceId,
        trustProfileId:  profile.id,
        sourceEventId:   incomingEvent.id || null,
        sourceEventType: incomingEvent.type,
        dimension:       impact.dimension,
        scoreDelta:      impact.delta,
        appliedPolicy:   policy.version,
        appliedAt:       this._clock.now().toISOString(),
      };

      await this._evidenceStore.append(evidence);

      const explanation = this._explainer.build({
        evidenceId,
        trustProfileId:   profile.id,
        dimension:        impact.dimension,
        delta:            impact.delta,
        scoreBefore:      scoreBefore,
        scoreAfter:       scoreBefore + impact.delta,
        confidenceBefore: profile.confidence.value,
        confidenceAfter:  profile.confidence.value,
        sourceEventType:  incomingEvent.type,
        policy,
        rule:             incomingEvent.type,
        clock:            this._clock,
      });

      await this._explanationStore.append(explanation);
    }

    profile.recalculateScore({ policy, clock: this._clock });

    await this._uow.trustProfiles.save(profile);
    await this._uow.commit();

    const scoreAfter = profile.score.value;

    if (scoreAfter !== scoreBefore) {
      this._uow.registerIntegrationEvents([
        new TrustScoreChanged({
          actorId,
          actorType:  profile.actorType,
          newScore:   scoreAfter,
          riskLevel:  profile.riskLevel.value,
          occurredAt: this._clock.now().toISOString(),
        }),
      ]);
    }

    await this._uow.publish();

    return { processed: true, scoreBefore, scoreAfter, impactsApplied: impacts.length };
  }
}

module.exports = { ProcessDomainEvent };
