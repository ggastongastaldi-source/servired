'use strict';
class IDistributionNodeRepository {
  async findById(nodeId)              { throw new Error('not implemented'); }
  async findByUserId(userId)          { throw new Error('not implemented'); }
  async findActiveByZone(zonaId)      { throw new Error('not implemented'); }
  async findActiveByZoneAndRubro(zonaId, rubroId) { throw new Error('not implemented'); }
  async save(node)                    { throw new Error('not implemented'); }
}
module.exports = { IDistributionNodeRepository };
