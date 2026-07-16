'use strict';
class NodeNotActiveError extends Error {
  constructor(nodeId, status) { super(`DistributionNode ${nodeId} no está ACTIVE (estado: ${status})`); this.name = 'NodeNotActiveError'; }
}
class NodeSaturatedError extends Error {
  constructor(nodeId) { super(`DistributionNode ${nodeId} está saturado`); this.name = 'NodeSaturatedError'; }
}
module.exports = { NodeNotActiveError, NodeSaturatedError };
