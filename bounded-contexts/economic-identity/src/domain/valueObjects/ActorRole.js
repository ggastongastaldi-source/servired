'use strict';

const VALID_ROLES = Object.freeze(['WORKER','MERCHANT','MANUFACTURER','CLIENT','DISTRIBUTOR']);

class ActorRole {
  constructor(value) {
    if (!VALID_ROLES.includes(value))
      throw new Error(`ActorRole inválido: ${value}. Válidos: ${VALID_ROLES.join(', ')}`);
    this._value = value;
  }
  get value() { return this._value; }
  equals(other) { return other instanceof ActorRole && other._value === this._value; }
  toString() { return this._value; }
  static from(value) { return new ActorRole(value); }
  static get VALID() { return VALID_ROLES; }
}

module.exports = { ActorRole };
