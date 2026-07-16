'use strict';
const { MongoEventStore }                  = require('../../shared/infrastructure/eventStore/MongoEventStore');
const { MongoDistributionNodeRepository }  = require('./repositories/MongoDistributionNodeRepository');
const { UnitOfWork } = require('./bus/UnitOfWork');

class DistributionNetworkDB {
  constructor({ eventStore, nodeRepo, publisher }) {
    this.eventStore = eventStore;
    this.nodeRepo   = nodeRepo;
    this._publisher = publisher;
  }
  createUnitOfWork() {
    return new UnitOfWork({ nodeRepository: this.nodeRepo, publisher: this._publisher });
  }

  static async initialize(db, publisher) {
    const eventStore = new MongoEventStore(db, 'dn_nodes');
    const nodeRepo   = new MongoDistributionNodeRepository(eventStore, db);
    await eventStore.ensureIndexes();
    await nodeRepo.ensureIndexes();
    return new DistributionNetworkDB({ eventStore, nodeRepo, publisher });
  }
}
module.exports = { DistributionNetworkDB };
