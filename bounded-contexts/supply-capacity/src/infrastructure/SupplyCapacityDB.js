'use strict';
const { MongoEventStore }            = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoSupplyOfferRepository } = require('./repositories/MongoSupplyOfferRepository');

class SupplyCapacityDB {
  constructor({ eventStore, offerRepo }) {
    this.eventStore = eventStore;
    this.offerRepo  = offerRepo;
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'sc_offers');
    const offerRepo  = new MongoSupplyOfferRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await offerRepo.ensureIndexes();
    return new SupplyCapacityDB({ eventStore, offerRepo });
  }
}
module.exports = { SupplyCapacityDB };
