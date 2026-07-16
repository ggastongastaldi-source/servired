'use strict';
const { TerritorialCycle } = require('../../domain/aggregates/TerritorialCycle');
const crypto = require('crypto');

class StartTerritorialCycle {
  constructor({ unitOfWork, idGenerator }) {
    this._uow         = unitOfWork;
    this._idGenerator = idGenerator || (() => crypto.randomUUID());
  }

  async execute({ zonaId, rubroId, actorId, clientId }) {
    const cycleId = this._idGenerator();
    const cycle   = TerritorialCycle.start({ cycleId, zonaId, rubroId, actorId, clientId });
    await this._uow.cycles.save(cycle);
    await this._uow.commit();
    this._uow.registerIntegrationEvents([{
      type: 'TerritorialCycleStarted', cycleId, zonaId, rubroId, actorId, clientId,
      occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { cycleId, zonaId, rubroId, status: cycle.status.value };
  }
}
module.exports = { StartTerritorialCycle };
