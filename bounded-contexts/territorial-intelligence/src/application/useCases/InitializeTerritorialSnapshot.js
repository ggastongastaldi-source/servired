'use strict';
const { TerritorialSnapshot } = require('../../domain/aggregates/TerritorialSnapshot');
const crypto = require('crypto');

class InitializeTerritorialSnapshot {
  constructor({ unitOfWork, idGenerator }) {
    this._uow         = unitOfWork;
    this._idGenerator = idGenerator || (() => crypto.randomUUID());
  }

  async execute({ zonaId, rubroIds }) {
    const existing = await this._uow.snapshots.findByZona(zonaId);
    if (existing) return { snapshotId: existing.id, zonaId, alreadyExists: true };
    const snapshotId = this._idGenerator();
    const snapshot   = TerritorialSnapshot.initialize({ snapshotId, zonaId, rubroIds });
    await this._uow.snapshots.save(snapshot);
    await this._uow.commit();
    return { snapshotId, zonaId, health: snapshot.health.value };
  }
}
module.exports = { InitializeTerritorialSnapshot };
