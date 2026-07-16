'use strict';
class ReserveSupplyCapacity {
  constructor({ unitOfWork }) { this._uow = unitOfWork; }

  async execute({ offerId, units, requestedBy }) {
    const offer = await this._uow.offers.findById(offerId);
    if (!offer) throw new Error(`SupplyOffer no encontrada: ${offerId}`);
    offer.reserveCapacity({ units, requestedBy });
    await this._uow.offers.save(offer);
    await this._uow.commit();
    this._uow.registerIntegrationEvents([{
      type: 'SupplyCapacityReserved', offerId, units, requestedBy,
      remainingUnits: offer.capacity.availableUnits,
      occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { offerId, remainingUnits: offer.capacity.availableUnits, status: offer.status.value };
  }
}
module.exports = { ReserveSupplyCapacity };
