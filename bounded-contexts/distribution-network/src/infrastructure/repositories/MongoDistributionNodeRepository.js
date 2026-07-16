'use strict';
const { IDistributionNodeRepository } = require('../../domain/ports/IDistributionNodeRepository');
const { DistributionNode }            = require('../../domain/aggregates/DistributionNode');

class MongoDistributionNodeRepository extends IDistributionNodeRepository {
  constructor(eventStore, db) {
    super();
    this._eventStore = eventStore;
    this._index      = db.collection('dn_node_index');
  }

  async ensureIndexes() {
    await this._index.createIndex({ nodeId:    1 }, { unique: true });
    await this._index.createIndex({ usuarioId: 1 }, { unique: true });
    await this._index.createIndex({ actorId:   1 });
    await this._index.createIndex({ status:    1 });
    await this._index.createIndex({ 'coverage.zonaIds':  1 });
    await this._index.createIndex({ 'coverage.rubroIds': 1 });
  }

  async findById(nodeId) {
    const events = await this._eventStore.getStream(nodeId);
    if (!events.length) return null;
    return DistributionNode.rehydrate(events);
  }

  async findByUserId(userId) {
    const doc = await this._index.findOne({ usuarioId: userId });
    if (!doc) return null;
    return this.findById(doc.nodeId);
  }

  async findActiveByZone(zonaId) {
    const docs = await this._index.find({ 'coverage.zonaIds': zonaId, status: 'ACTIVE' }).toArray();
    return Promise.all(docs.map(d => this.findById(d.nodeId)));
  }

  async findActiveByZoneAndRubro(zonaId, rubroId) {
    const docs = await this._index.find({
      'coverage.zonaIds': zonaId, 'coverage.rubroIds': rubroId, status: 'ACTIVE'
    }).toArray();
    return Promise.all(docs.map(d => this.findById(d.nodeId)));
  }

  async save(node) {
    const events = node.pullDomainEvents();
    if (!events.length) return;
    await this._eventStore.append(node.id, events, node.expectedVersion);
    await this._index.updateOne(
      { nodeId: node.id },
      { $set: { nodeId: node.id, usuarioId: node.usuarioId, actorId: node.actorId,
                status: node.status.value, coverage: node.coverage.toJSON(),
                updatedAt: new Date() } },
      { upsert: true }
    );
  }
}
module.exports = { MongoDistributionNodeRepository };
