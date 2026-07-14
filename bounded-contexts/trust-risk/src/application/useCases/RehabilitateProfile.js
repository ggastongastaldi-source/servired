'use strict';

const { TrustProfileNotFoundError, InvalidRehabilitationError } = require('../../domain/errors');
const { AccountRehabilitated } = require('../../domain/events/integration/AccountRehabilitated');

/**
 * RehabilitateProfile — Use Case
 *
 * Transita un perfil REHABILITATING → ACTIVE si el score supera el umbral.
 * ADR-006: GIA recomienda, el operador ejecuta este comando.
 * ADR-009: nunca sin confidence suficiente.
 */
class RehabilitateProfile {

  constructor({ unitOfWork, policyRegistry, clock }) {
    this._uow            = unitOfWork;
    this._policyRegistry = policyRegistry;
    this._clock          = clock;
  }

  async execute({ actorId }) {
    const profile = await this._uow.trustProfiles.findByActorId(actorId);
    if (!profile) throw new TrustProfileNotFoundError(actorId);

    if (profile.status.value !== 'REHABILITATING') {
      throw new InvalidRehabilitationError(profile.status.value);
    }

    const policy        = await this._policyRegistry.getActivePolicy();
    const minScore      = policy.rehabilitationMinScore || 45;
    const openCases     = await this._uow.riskCases.findOpenByProfileId(profile.id);

    if (openCases.length > 0) {
      return { actorId, rehabilitated: false, reason: 'open_cases_pending' };
    }

    if (profile.score.value < minScore) {
      return { actorId, rehabilitated: false, reason: 'score_too_low', score: profile.score.value, required: minScore };
    }

    profile.changeStatus({ newStatus: 'ACTIVE', reason: 'rehabilitacion_completada', policy, clock: this._clock });

    await this._uow.trustProfiles.save(profile);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([
      new AccountRehabilitated({
        actorId,
        actorType:   profile.actorType,
        newScore:    profile.score.value,
        effectiveAt: this._clock.now().toISOString(),
      }),
    ]);

    await this._uow.publish();

    return { actorId, rehabilitated: true, newScore: profile.score.value };
  }
}

module.exports = { RehabilitateProfile };
