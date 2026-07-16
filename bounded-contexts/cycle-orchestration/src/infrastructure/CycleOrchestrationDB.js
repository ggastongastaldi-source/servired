'use strict';
const { MongoEventStore }                  = require('./eventStore/MongoEventStore');
const { MongoTerritorialCycleRepository }  = require('./repositories/MongoTerritorialCycleRepository');

class CycleOrchestrationDB {
  constructor({ eventStore, cycleRepo }) {
    this.eventStore = eventStore;
    this.cycleRepo  = cycleRepo;
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'co_cycles');
    const cycleRepo  = new MongoTerritorialCycleRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await cycleRepo.ensureIndexes();
    return new CycleOrchestrationDB({ eventStore, cycleRepo });
  }
}
module.exports = { CycleOrchestrationDB };
