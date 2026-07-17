'use strict';

/**
 * IProspectActorRepository — Puerto del repositorio de ProspectActor.
 * La implementación concreta vive en infrastructure/repositories/.
 */
class IProspectActorRepository {
  async save(prospectActor)      { throw new Error('Not implemented'); }
  async findById(id)             { throw new Error('Not implemented'); }
  async findByTerritoryId(territoryId) { throw new Error('Not implemented'); }
  async findByStatus(status)     { throw new Error('Not implemented'); }
}

module.exports = { IProspectActorRepository };
