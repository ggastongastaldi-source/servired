'use strict';
class ITerritorialCycleRepository {
  async findById(cycleId)          { throw new Error('not implemented'); }
  async findByZona(zonaId, limit)  { throw new Error('not implemented'); }
  async findActive()               { throw new Error('not implemented'); }
  async save(cycle)                { throw new Error('not implemented'); }
}
module.exports = { ITerritorialCycleRepository };
