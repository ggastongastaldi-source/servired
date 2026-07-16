'use strict';
const { MongoEventStore }                  = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoDistributionNodeRepository }  = require('./repositories/MongoDistributionNodeRepository');

class DistributionNetworkDB {
  constructor({ eventStore, nodeRepo }) {
    this.eventStore = eventStore;
    this.nodeRepo   = nodeRepo;
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'dn_nodes');
    const nodeRepo   = new MongoDistributionNodeRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await nodeRepo.ensureIndexes();
    return new DistributionNetworkDB({ eventStore, nodeRepo });
  }
}
module.exports = { DistributionNetworkDB };
