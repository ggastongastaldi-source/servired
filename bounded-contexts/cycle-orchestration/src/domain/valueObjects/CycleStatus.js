'use strict';
const STATES = Object.freeze(['INITIATED','OFFER_RESERVED','DISTRIBUTION_ASSIGNED','WORKER_ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED']);
const TRANSITIONS = Object.freeze({
  INITIATED:             ['OFFER_RESERVED','CANCELLED'],
  OFFER_RESERVED:        ['DISTRIBUTION_ASSIGNED','CANCELLED'],
  DISTRIBUTION_ASSIGNED: ['WORKER_ASSIGNED','CANCELLED'],
  WORKER_ASSIGNED:       ['IN_PROGRESS','CANCELLED'],
  IN_PROGRESS:           ['COMPLETED','CANCELLED'],
  COMPLETED:             [],
  CANCELLED:             [],
});
class CycleStatus {
  constructor(value) {
    if (!STATES.includes(value)) throw new Error(`CycleStatus inválido: ${value}`);
    this._value = value;
  }
  get value()      { return this._value; }
  get isTerminal() { return ['COMPLETED','CANCELLED'].includes(this._value); }
  canTransitionTo(next) { return TRANSITIONS[this._value]?.includes(next) ?? false; }
  transitionTo(next) {
    if (!this.canTransitionTo(next)) throw new Error(`Transición inválida: ${this._value} → ${next}`);
    return new CycleStatus(next);
  }
  static get INITIATED() { return new CycleStatus('INITIATED'); }
  toString() { return this._value; }
}
module.exports = { CycleStatus };
