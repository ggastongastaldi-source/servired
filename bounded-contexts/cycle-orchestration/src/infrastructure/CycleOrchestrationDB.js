'use strict';
const { MongoEventStore }                  = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoTerritorialCycleRepository }  = require('./repositories/MongoTerritorialCycleRepository');
const { UnitOfWork } = require('./bus/UnitOfWork');

class CycleOrchestrationDB {
  constructor({ eventStore, cycleRepo, publisher }) {
    this.eventStore = eventStore;
    this.cycleRepo  = cycleRepo;
    this._publisher = publisher;
  }
  createUnitOfWork() {
    return new UnitOfWork({ cycleRepository: this.cycleRepo, publisher: this._publisher });
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'co_cycles');
    const cycleRepo  = new MongoTerritorialCycleRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await cycleRepo.ensureIndexes();
    return new CycleOrchestrationDB({ eventStore, cycleRepo, publisher });
  }
}
module.exports = { CycleOrchestrationDB };
