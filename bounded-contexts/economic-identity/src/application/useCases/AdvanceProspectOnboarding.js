'use strict';

/**
 * AdvanceProspectOnboarding — Use Case.
 *
 * Avanza el estado de un ProspectActor en el ciclo de incorporación.
 * Acciones posibles: contact | educate | activate | lose_contact
 *
 * Al ACTIVATE: emite ProspectActorActivated → dispara RegisterEconomicActor.
 */
class AdvanceProspectOnboarding {
  constructor({ prospectActorRepository, eventPublisher }) {
    this._repo      = prospectActorRepository;
    this._publisher = eventPublisher;
  }

  async execute({ prospectId, action, payload = {} }) {
    const prospect = await this._repo.findById(prospectId);
    if (!prospect) throw new Error(`ProspectActor no encontrado: ${prospectId}`);

    switch (action) {
      case 'contact':
        prospect.registerContact(payload);
        break;
      case 'educate':
        prospect.registerEducation(payload);
        break;
      case 'activate':
        prospect.activate(payload);
        break;
      case 'lose_contact':
        prospect.loseContact(payload);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

    await this._repo.save(prospect);
    const events = prospect.pullDomainEvents();
    for (const event of events) await this._publisher.publish(event);
    return { prospectId, newStatus: prospect.status.value };
  }
}

module.exports = { AdvanceProspectOnboarding };
