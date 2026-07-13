const { InvalidProfileTransitionError } = require('../errors');

const TRANSITIONS = {
  ACTIVE:          ['QUARANTINED','SUSPENDED'],
  QUARANTINED:     ['REHABILITATING','SUSPENDED'],
  REHABILITATING:  ['ACTIVE','QUARANTINED'],
  SUSPENDED:       [],
};

class ProfileStatus {
  constructor(value) {
    if (!TRANSITIONS[value]) throw new Error(`Invalid ProfileStatus: ${value}`);
    this._value = value;
    Object.freeze(this);
  }
  get value() { return this._value; }
  canTransitionTo(next) {
    return TRANSITIONS[this._value].includes(next instanceof ProfileStatus ? next.value : next);
  }
  transitionTo(next) {
    const nextVal = next instanceof ProfileStatus ? next.value : next;
    if (!this.canTransitionTo(nextVal)) {
      throw new InvalidProfileTransitionError(this._value, nextVal);
    }
    return new ProfileStatus(nextVal);
  }
  allowedTransitions() { return TRANSITIONS[this._value].map(v => new ProfileStatus(v)); }
  equals(other) { return other instanceof ProfileStatus && this._value === other.value; }
  toString() { return this._value; }
  static of(value) { return new ProfileStatus(value); }
  static ACTIVE          = new ProfileStatus('ACTIVE');
  static QUARANTINED     = new ProfileStatus('QUARANTINED');
  static REHABILITATING  = new ProfileStatus('REHABILITATING');
  static SUSPENDED       = new ProfileStatus('SUSPENDED');
}

module.exports = { ProfileStatus, TRANSITIONS };
