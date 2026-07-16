'use strict';
const { DistributionNode } = require('../../domain/aggregates/DistributionNode');
const crypto = require('crypto');

class RegisterDistributionNode {
  constructor({ unitOfWork, idGenerator }) {
    this._uow         = unitOfWork;
    this._idGenerator = idGenerator || (() => crypto.randomUUID());
  }

  async execute({ usuarioId, actorId, coverage, capacity }) {
    const existing = await this._uow.nodes.findByUserId(usuarioId);
    if (existing) throw new Error(`DistributionNode ya existe para usuario: ${usuarioId}`);
    const nodeId = this._idGenerator();
    const node   = DistributionNode.create({ nodeId, usuarioId, actorId, coverage, capacity });
    await this._uow.nodes.save(node);
    await this._uow.commit();
    this._uow.registerIntegrationEvents([{
      type: 'DistributionNodeRegistered', nodeId, usuarioId, actorId,
      coverage: node.coverage.toJSON(), occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { nodeId, usuarioId, status: node.status.value };
  }
}
module.exports = { RegisterDistributionNode };
