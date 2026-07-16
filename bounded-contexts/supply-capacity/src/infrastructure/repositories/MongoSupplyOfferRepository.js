'use strict';
const { ISupplyOfferRepository } = require('../../domain/ports/ISupplyOfferRepository');
const { SupplyOffer }            = require('../../domain/aggregates/SupplyOffer');

class MongoSupplyOfferRepository extends ISupplyOfferRepository {
  constructor(eventStore, db) {
    super();
    this._eventStore = eventStore;
    this._index      = db.collection('sc_offer_index');
  }

  async ensureIndexes() {
    await this._index.createIndex({ offerId:  1 }, { unique: true });
    await this._index.createIndex({ actorId:  1 });
    await this._index.createIndex({ rubroId:  1 });
    await this._index.createIndex({ zonaIds:  1 });
    await this._index.createIndex({ status:   1 });
  }

  async findById(offerId) {
    const events = await this._eventStore.getStream(offerId);
    if (!events.length) return null;
    return SupplyOffer.rehydrate(events);
  }

  async findByActorId(actorId) {
    const docs = await this._index.find({ actorId }).toArray();
    return Promise.all(docs.map(d => this.findById(d.offerId)));
  }

  async findActiveByZone(zonaId) {
    const docs = await this._index.find({ zonaIds: zonaId, status: 'ACTIVE' }).toArray();
    return Promise.all(docs.map(d => this.findById(d.offerId)));
  }

  async save(offer) {
    const events = offer.pullDomainEvents();
    if (!events.length) return;
    await this._eventStore.append(offer.id, events, offer.expectedVersion);
    const statusEvent = [...events].reverse().find(e =>
      ['SupplyOfferCreated','SupplyOfferActivated','SupplyOfferPaused',
       'SupplyOfferWithdrawn','SupplyOfferExhausted'].includes(e.type)
    );
    if (statusEvent) {
      await this._index.updateOne(
        { offerId: offer.id },
        { $set: { offerId: offer.id, actorId: offer.actorId, rubroId: offer.rubroId,
                  zonaIds: offer.zonaIds, status: offer.status.value, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  }
}
module.exports = { MongoSupplyOfferRepository };
