'use strict';
const { MongoEventStore }                      = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoTerritorialSnapshotRepository }   = require('./repositories/MongoTerritorialSnapshotRepository');
const { UnitOfWork } = require('./bus/UnitOfWork');

class TerritorialIntelligenceDB {
  constructor({ eventStore, snapshotRepo, publisher }) {
    this.eventStore   = eventStore;
    this.snapshotRepo = snapshotRepo;
    this._publisher   = publisher;
  }
  createUnitOfWork() {
    return new UnitOfWork({ snapshotRepository: this.snapshotRepo, publisher: this._publisher });
  }

  static async initialize(db, publisher) {
    const eventStore   = new MongoEventStore(db, 'ti_snapshots');
    const snapshotRepo = new MongoTerritorialSnapshotRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await snapshotRepo.ensureIndexes();
    return new TerritorialIntelligenceDB({ eventStore, snapshotRepo, publisher });
  }
}
module.exports = { TerritorialIntelligenceDB };
