'use strict';
const STATES      = Object.freeze(['DRAFT','ACTIVE','PAUSED','EXHAUSTED','WITHDRAWN']);
const TRANSITIONS = Object.freeze({
  DRAFT:     ['ACTIVE'],
  ACTIVE:    ['PAUSED','EXHAUSTED','WITHDRAWN'],
  PAUSED:    ['ACTIVE','WITHDRAWN'],
  EXHAUSTED: ['ACTIVE'],
  WITHDRAWN: [],
});
class OfferStatus {
  constructor(value) {
    if (!STATES.includes(value)) throw new Error(`OfferStatus inválido: ${value}`);
    this._value = value;
  }
  get value() { return this._value; }
  canTransitionTo(next) { return TRANSITIONS[this._value]?.includes(next) ?? false; }
  transitionTo(next) {
    if (!this.canTransitionTo(next)) throw new Error(`Transición inválida: ${this._value} → ${next}`);
    return new OfferStatus(next);
  }
  static get DRAFT()  { return new OfferStatus('DRAFT'); }
  static get ACTIVE() { return new OfferStatus('ACTIVE'); }
  toString() { return this._value; }
}
module.exports = { OfferStatus };
