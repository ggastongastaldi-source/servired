'use strict';
const { TerritorialSnapshot } = require('../../domain/aggregates/TerritorialSnapshot');
const crypto = require('crypto');

class ProcessEconomicSignal {
  constructor({ unitOfWork, idGenerator }) {
    this._uow         = unitOfWork;
    this._idGenerator = idGenerator || (() => crypto.randomUUID());
  }

  async execute({ type, zonaId, rubroId, actorId, magnitude }) {
    let snapshot = await this._uow.snapshots.findByZona(zonaId);
    if (!snapshot) {
      // Auto-inicializar si no existe
      const snapshotId = this._idGenerator();
      snapshot = TerritorialSnapshot.initialize({ snapshotId, zonaId, rubroIds: [rubroId] });
    }
    const prevHealth = snapshot.health.value;
    snapshot.receiveSignal({ type, zonaId, rubroId, actorId, magnitude });
    await this._uow.snapshots.save(snapshot);
    await this._uow.commit();

    const newHealth = snapshot.health.value;
    if (newHealth !== prevHealth) {
      this._uow.registerIntegrationEvents([{
        type: 'ZoneHealthChanged', zonaId, rubroId,
        fromHealth: prevHealth, toHealth: newHealth,
        occurredAt: new Date().toISOString(),
      }]);
      await this._uow.publish();
    }
    return { zonaId, health: newHealth, activeOffers: snapshot.activeOffers, activeNodes: snapshot.activeNodes };
  }
}
module.exports = { ProcessEconomicSignal };
