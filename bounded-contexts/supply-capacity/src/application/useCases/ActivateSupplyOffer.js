'use strict';
class ActivateSupplyOffer {
  constructor({ unitOfWork }) { this._uow = unitOfWork; }

  async execute({ offerId }) {
    const offer = await this._uow.offers.findById(offerId);
    if (!offer) throw new Error(`SupplyOffer no encontrada: ${offerId}`);
    offer.activate();
    await this._uow.offers.save(offer);
    await this._uow.commit();
    this._uow.registerIntegrationEvents([{
      type: 'SupplyOfferActivated', offerId,
      rubroId: offer.rubroId, zonaIds: offer.zonaIds,
      occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { offerId, status: offer.status.value };
  }
}
module.exports = { ActivateSupplyOffer };
