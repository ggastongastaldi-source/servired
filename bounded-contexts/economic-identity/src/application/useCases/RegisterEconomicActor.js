'use strict';
const { EconomicActor } = require('../../domain/aggregates/EconomicActor');
const { DuplicateEconomicActorError } = require('../../domain/errors');
const crypto = require('crypto');

class RegisterEconomicActor {
  constructor({ unitOfWork, idGenerator }) {
    this._uow         = unitOfWork;
    this._idGenerator = idGenerator || (() => crypto.randomUUID());
  }

  async execute({ userId, role }) {
    if (!userId) throw new Error('userId requerido');
    if (!role)   throw new Error('role requerido');

    const existing = await this._uow.actors.findByUserId(userId);
    if (existing) throw new DuplicateEconomicActorError(userId);

    const actorId = this._idGenerator();
    const actor   = EconomicActor.create({ actorId, userId, role });

    await this._uow.actors.save(actor);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([{
      type:      'EconomicActorRegistered',
      actorId,
      userId,
      role,
      occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();

    return { actorId, userId, role };
  }
}
module.exports = { RegisterEconomicActor };
