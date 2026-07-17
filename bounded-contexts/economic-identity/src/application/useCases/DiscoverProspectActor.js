'use strict';

const { ProspectActor } = require('../../domain/aggregates/ProspectActor');

/**
 * DiscoverProspectActor — Use Case (Fase 2 del Ciclo Territorial).
 *
 * Registra un candidato descubierto durante la Fase 1 (Inteligencia Territorial).
 * El CET ingresa los datos; el sistema crea el ProspectActor en DISCOVERED.
 */
class DiscoverProspectActor {
  constructor({ prospectActorRepository, eventPublisher }) {
    this._repo      = prospectActorRepository;
    this._publisher = eventPublisher;
  }

  async execute({ prospectId, territoryId, businessName, rubro, contactInfo, cetId }) {
    const prospect = ProspectActor.discover({
      prospectId, territoryId, businessName, rubro, contactInfo, cetId,
    });
    await this._repo.save(prospect);
    const events = prospect.pullDomainEvents();
    for (const event of events) await this._publisher.publish(event);
    return { prospectId: prospect.id };
  }
}

module.exports = { DiscoverProspectActor };
