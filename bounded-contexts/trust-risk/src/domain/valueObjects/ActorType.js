const TYPES = ['CLIENT','WORKER','MERCHANT','SME','MANUFACTURER'];

class ActorType {
  constructor(value) {
    if (!TYPES.includes(value)) throw new Error(`Invalid ActorType: ${value}`);
    this._value = value;
    Object.freeze(this);
  }
  get value() { return this._value; }
  equals(other) { return other instanceof ActorType && this._value === other.value; }
  toString() { return this._value; }
  static of(value) { return new ActorType(value); }
  static CLIENT       = new ActorType('CLIENT');
  static WORKER       = new ActorType('WORKER');
  static MERCHANT     = new ActorType('MERCHANT');
  static SME          = new ActorType('SME');
  static MANUFACTURER = new ActorType('MANUFACTURER');
}

module.exports = { ActorType };
