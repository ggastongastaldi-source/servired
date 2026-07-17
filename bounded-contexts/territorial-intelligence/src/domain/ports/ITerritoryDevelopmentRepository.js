'use strict';

class ITerritoryDevelopmentRepository {
  async save(territory)          { throw new Error('Not implemented'); }
  async findById(id)             { throw new Error('Not implemented'); }
  async findByRegion(region)     { throw new Error('Not implemented'); }
  async findByStatus(status)     { throw new Error('Not implemented'); }
}

module.exports = { ITerritoryDevelopmentRepository };
