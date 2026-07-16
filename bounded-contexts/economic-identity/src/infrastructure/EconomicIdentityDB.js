'use strict';
const { MongoEventStore }               = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoEconomicActorRepository }  = require('./repositories/MongoEconomicActorRepository');
const { UnitOfWork }                    = require('./bus/UnitOfWork');

class EconomicIdentityDB {
  constructor({ eventStore, actorRepo, publisher }) {
    this.eventStore = eventStore;
    this.actorRepo  = actorRepo;
    this._publisher = publisher;
  }
  createUnitOfWork() {
    return new UnitOfWork({ actorRepository: this.actorRepo, publisher: this._publisher });
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'ei_actors');
    const actorRepo  = new MongoEconomicActorRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await actorRepo.ensureIndexes();
    return new EconomicIdentityDB({ eventStore, actorRepo, publisher });
  }
}
module.exports = { EconomicIdentityDB };
