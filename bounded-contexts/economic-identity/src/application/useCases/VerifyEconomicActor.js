'use strict';
class VerifyEconomicActor {
  constructor({ unitOfWork }) { this._uow = unitOfWork; }

  async execute({ actorId, verifiedBy }) {
    const actor = await this._uow.actors.findById(actorId);
    if (!actor) throw new Error(`EconomicActor no encontrado: ${actorId}`);

    actor.startVerification();
    actor.verify({ verifiedBy });
    await this._uow.actors.save(actor);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([{
      type: 'EconomicActorVerified', actorId,
      verifiedBy, occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { actorId, status: actor.verificationStatus.value };
  }
}
module.exports = { VerifyEconomicActor };
