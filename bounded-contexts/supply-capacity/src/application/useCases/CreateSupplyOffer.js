'use strict';
const { SupplyOffer } = require('../../domain/aggregates/SupplyOffer');
const crypto = require('crypto');

class CreateSupplyOffer {
  constructor({ unitOfWork, idGenerator }) {
    this._uow         = unitOfWork;
    this._idGenerator = idGenerator || (() => crypto.randomUUID());
  }

  async execute({ actorId, rubroId, zonaIds, capacity, terms }) {
    const offerId = this._idGenerator();
    const offer   = SupplyOffer.create({ offerId, actorId, rubroId, zonaIds, capacity, terms });

    await this._uow.offers.save(offer);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([{
      type: 'SupplyOfferCreated', offerId, actorId, rubroId, zonaIds,
      occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { offerId, actorId, rubroId, status: offer.status.value };
  }
}
module.exports = { CreateSupplyOffer };
