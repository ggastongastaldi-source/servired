'use strict';
class ActivateDistributionNode {
  constructor({ unitOfWork }) { this._uow = unitOfWork; }

  async execute({ nodeId }) {
    const node = await this._uow.nodes.findById(nodeId);
    if (!node) throw new Error(`DistributionNode no encontrado: ${nodeId}`);
    node.activate();
    await this._uow.nodes.save(node);
    await this._uow.commit();
    this._uow.registerIntegrationEvents([{
      type: 'DistributionNodeActivated', nodeId,
      coverage: node.coverage.toJSON(), occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { nodeId, status: node.status.value };
  }
}
module.exports = { ActivateDistributionNode };
