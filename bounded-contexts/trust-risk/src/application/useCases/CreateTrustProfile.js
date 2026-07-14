'use strict';

const { DuplicateTrustProfileError } = require('../../domain/errors');
const { ActorType }                  = require('../../domain/valueObjects/ActorType');
const { TrustProfile }               = require('../../domain/aggregates/TrustProfile');
const { TrustScoreChanged }          = require('../../domain/events/integration/TrustScoreChanged');

/**
 * CreateTrustProfile — Use Case
 *
 * Crea un TrustProfile nuevo para un actor del ecosistema.
 * Si ya existe uno para ese actorId, lanza DuplicateTrustProfileError.
 *
 * Patrón:
 *   1. Verificar que no existe
 *   2. Crear el agregado (emite TrustProfileCreated)
 *   3. Persistir via UnitOfWork
 *   4. Publicar TrustScoreChanged hacia SINAPSIS
 */
class CreateTrustProfile {

  constructor({ unitOfWork, policyRegistry, clock, idGenerator }) {
    this._uow           = unitOfWork;
    this._policyRegistry = policyRegistry;
    this._clock         = clock;
    this._idGenerator   = idGenerator;
  }

  async execute({ actorId, actorType }) {
    const existing = await this._uow.trustProfiles.findByActorId(actorId);
    if (existing) throw new DuplicateTrustProfileError(actorId);

    const policy         = await this._policyRegistry.getActivePolicy();
    const trustProfileId = this._idGenerator();
    const actor          = ActorType.of(actorType);

    const profile = TrustProfile.create({
      trustProfileId,
      actorId,
      actorType: actor,
      policy,
      clock: this._clock,
    });

    await this._uow.trustProfiles.save(profile);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([
      new TrustScoreChanged({
        actorId,
        actorType,
        newScore:  profile.score.value,
        riskLevel: profile.riskLevel.value,
        occurredAt: this._clock.now().toISOString(),
      }),
    ]);

    await this._uow.publish();

    return { trustProfileId, actorId, actorType, score: profile.score.value };
  }
}

module.exports = { CreateTrustProfile };
