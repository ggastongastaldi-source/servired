'use strict';
const { MongoEventStore }            = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoSupplyOfferRepository } = require('./repositories/MongoSupplyOfferRepository');
const { UnitOfWork } = require('./bus/UnitOfWork');

class SupplyCapacityDB {
  constructor({ eventStore, offerRepo, publisher }) {
    this.eventStore = eventStore;
    this.offerRepo  = offerRepo;
    this._publisher = publisher;
  }
  createUnitOfWork() {
    return new UnitOfWork({ offerRepository: this.offerRepo, publisher: this._publisher });
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'sc_offers');
    const offerRepo  = new MongoSupplyOfferRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await offerRepo.ensureIndexes();
    return new SupplyCapacityDB({ eventStore, offerRepo, publisher });
  }
}
module.exports = { SupplyCapacityDB };
