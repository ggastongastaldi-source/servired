'use strict';
class IEconomicActorRepository {
  async findById(actorId)       { throw new Error('not implemented'); }
  async findByUserId(userId)    { throw new Error('not implemented'); }
  async save(actor)             { throw new Error('not implemented'); }
}
module.exports = { IEconomicActorRepository };
