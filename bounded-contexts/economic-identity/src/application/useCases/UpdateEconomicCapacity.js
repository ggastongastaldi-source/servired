'use strict';
class UpdateEconomicCapacity {
  constructor({ unitOfWork }) { this._uow = unitOfWork; }

  async execute({ actorId, rubroIds, zonaIds, maxConcurrentJobs, monthlyCapacityARS }) {
    const actor = await this._uow.actors.findById(actorId);
    if (!actor) throw new Error(`EconomicActor no encontrado: ${actorId}`);

    actor.updateCapacity({ rubroIds, zonaIds, maxConcurrentJobs, monthlyCapacityARS });
    await this._uow.actors.save(actor);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([{
      type: 'EconomicCapacityUpdated', actorId,
      capacity: actor.capacity.toJSON(), occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { actorId, capacity: actor.capacity.toJSON() };
  }
}
module.exports = { UpdateEconomicCapacity };
