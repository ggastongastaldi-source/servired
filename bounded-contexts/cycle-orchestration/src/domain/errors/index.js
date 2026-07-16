'use strict';
class CycleAlreadyTerminalError extends Error {
  constructor(cycleId, status) { super(`Ciclo ${cycleId} ya está en estado terminal: ${status}`); this.name = 'CycleAlreadyTerminalError'; }
}
class InvalidCycleTransitionError extends Error {
  constructor(from, to) { super(`Transición de ciclo inválida: ${from} → ${to}`); this.name = 'InvalidCycleTransitionError'; }
}
module.exports = { CycleAlreadyTerminalError, InvalidCycleTransitionError };
