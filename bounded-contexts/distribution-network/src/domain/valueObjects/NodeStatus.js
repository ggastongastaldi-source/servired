'use strict';
const STATES = Object.freeze(['INACTIVE','ACTIVE','SATURATED','OFFLINE']);
const TRANSITIONS = Object.freeze({
  INACTIVE:  ['ACTIVE'],
  ACTIVE:    ['SATURATED','OFFLINE'],
  SATURATED: ['ACTIVE','OFFLINE'],
  OFFLINE:   ['ACTIVE'],
});
class NodeStatus {
  constructor(value) {
    if (!STATES.includes(value)) throw new Error(`NodeStatus inválido: ${value}`);
    this._value = value;
  }
  get value() { return this._value; }
  canTransitionTo(next) { return TRANSITIONS[this._value]?.includes(next) ?? false; }
  transitionTo(next) {
    if (!this.canTransitionTo(next)) throw new Error(`Transición inválida: ${this._value} → ${next}`);
    return new NodeStatus(next);
  }
  static get INACTIVE() { return new NodeStatus('INACTIVE'); }
  static get ACTIVE()   { return new NodeStatus('ACTIVE'); }
  toString() { return this._value; }
}
module.exports = { NodeStatus };
