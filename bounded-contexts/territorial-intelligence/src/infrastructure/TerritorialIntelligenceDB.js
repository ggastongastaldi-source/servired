'use strict';
const { MongoEventStore }                      = require('./eventStore/MongoEventStore');
const { MongoTerritorialSnapshotRepository }   = require('./repositories/MongoTerritorialSnapshotRepository');

class TerritorialIntelligenceDB {
  constructor({ eventStore, snapshotRepo }) {
    this.eventStore   = eventStore;
    this.snapshotRepo = snapshotRepo;
  }

  static async initialize(db, publisher) {
    const eventStore   = new MongoEventStore(db, 'ti_snapshots');
    const snapshotRepo = new MongoTerritorialSnapshotRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await snapshotRepo.ensureIndexes();
    return new TerritorialIntelligenceDB({ eventStore, snapshotRepo });
  }
}
module.exports = { TerritorialIntelligenceDB };
