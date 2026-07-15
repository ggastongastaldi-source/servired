'use strict';

const STATES = Object.freeze(['UNVERIFIED','PENDING','VERIFIED','SUSPENDED','REVOKED']);
const TRANSITIONS = Object.freeze({
  UNVERIFIED: ['PENDING'],
  PENDING:    ['VERIFIED','UNVERIFIED'],
  VERIFIED:   ['SUSPENDED'],
  SUSPENDED:  ['VERIFIED','REVOKED'],
  REVOKED:    [],
});

class VerificationStatus {
  constructor(value) {
    if (!STATES.includes(value))
      throw new Error(`VerificationStatus inválido: ${value}`);
    this._value = value;
  }
  get value() { return this._value; }
  canTransitionTo(next) {
    return TRANSITIONS[this._value]?.includes(next) ?? false;
  }
  transitionTo(next) {
    if (!this.canTransitionTo(next))
      throw new Error(`Transición inválida: ${this._value} → ${next}`);
    return new VerificationStatus(next);
  }
  equals(other) { return other instanceof VerificationStatus && other._value === this._value; }
  toString() { return this._value; }
  static get UNVERIFIED() { return new VerificationStatus('UNVERIFIED'); }
  static get PENDING()    { return new VerificationStatus('PENDING'); }
  static get VERIFIED()   { return new VerificationStatus('VERIFIED'); }
}

module.exports = { VerificationStatus };
