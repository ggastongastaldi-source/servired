'use strict';
class DuplicateEconomicActorError extends Error {
  constructor(actorId) { super(`EconomicActor ya existe: ${actorId}`); this.name = 'DuplicateEconomicActorError'; }
}
class InvalidVerificationTransitionError extends Error {
  constructor(from, to) { super(`Transición de verificación inválida: ${from} → ${to}`); this.name = 'InvalidVerificationTransitionError'; }
}
class ActorSuspendedError extends Error {
  constructor(actorId) { super(`Actor suspendido: ${actorId}`); this.name = 'ActorSuspendedError'; }
}
module.exports = { DuplicateEconomicActorError, InvalidVerificationTransitionError, ActorSuspendedError };
