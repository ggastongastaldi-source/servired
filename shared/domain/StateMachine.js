'use strict';

/**
 * StateMachine — Utilidad base para Value Objects de estado con FSM.
 *
 * Elimina la duplicación de lógica de transición que existe en
 * CycleStatus, VerificationStatus y ZoneHealth.
 *
 * Uso: cada Value Object extiende StateMachine y define TRANSITIONS.
 *
 * @example
 * class ProspectStatus extends StateMachine {
 *   static get TRANSITIONS() {
 *     return { DISCOVERED: ['CONTACTED'], CONTACTED: ['EDUCATED'], ... };
 *   }
 * }
 */
class StateMachine {
  constructor(value) {
    const valid = Object.keys(this.constructor.TRANSITIONS);
    if (!valid.includes(value)) {
      throw new Error(
        `[${this.constructor.name}] Estado inválido: "${value}". ` +
        `Permitidos: ${valid.join(', ')}`
      );
    }
    this._value = value;
  }

  get value() { return this._value; }

  canTransitionTo(next) {
    return (this.constructor.TRANSITIONS[this._value] || []).includes(next);
  }

  transitionTo(next) {
    if (!this.canTransitionTo(next)) {
      const allowed = (this.constructor.TRANSITIONS[this._value] || []).join(', ') || 'ninguna';
      throw new Error(
        `[${this.constructor.name}] Transición inválida: ${this._value} → ${next}. ` +
        `Permitidas desde ${this._value}: ${allowed}`
      );
    }
    return new this.constructor(next);
  }

  equals(other) {
    return other instanceof this.constructor && other._value === this._value;
  }

  toString() { return this._value; }
  toJSON()   { return this._value; }
}

module.exports = { StateMachine };
