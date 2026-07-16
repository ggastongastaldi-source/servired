'use strict';
class ISupplyOfferRepository {
  async findById(offerId)        { throw new Error('not implemented'); }
  async findByActorId(actorId)   { throw new Error('not implemented'); }
  async findActiveByZone(zonaId) { throw new Error('not implemented'); }
  async save(offer)              { throw new Error('not implemented'); }
}
module.exports = { ISupplyOfferRepository };
