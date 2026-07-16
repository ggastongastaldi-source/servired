'use strict';
const { MongoEventStore }               = require('./eventStore/MongoEventStore');
const { MongoEconomicActorRepository }  = require('./repositories/MongoEconomicActorRepository');

class EconomicIdentityDB {
  constructor({ eventStore, actorRepo }) {
    this.eventStore = eventStore;
    this.actorRepo  = actorRepo;
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'ei_actors');
    const actorRepo  = new MongoEconomicActorRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await actorRepo.ensureIndexes();
    return new EconomicIdentityDB({ eventStore, actorRepo });
  }
}
module.exports = { EconomicIdentityDB };
