const TYPES = ['LINEAR','EXPONENTIAL','STEP'];

class DecayFunction {
  constructor(type) {
    if (!TYPES.includes(type)) throw new Error(`Invalid DecayFunction: ${type}`);
    this._type = type;
    Object.freeze(this);
  }
  get type() { return this._type; }
  apply(initialWeight, elapsedMs, ttlMs) {
    const ratio = Math.min(1, elapsedMs / ttlMs);
    switch (this._type) {
      case 'LINEAR':      return initialWeight * (1 - ratio);
      case 'EXPONENTIAL': return initialWeight * Math.pow(1 - ratio, 2);
      case 'STEP':        return ratio < 0.5 ? initialWeight : 0;
      default:            return 0;
    }
  }
  equals(other) { return other instanceof DecayFunction && this._type === other.type; }
  toString() { return this._type; }
  static of(type) { return new DecayFunction(type); }
  static LINEAR      = new DecayFunction('LINEAR');
  static EXPONENTIAL = new DecayFunction('EXPONENTIAL');
  static STEP        = new DecayFunction('STEP');
}

module.exports = { DecayFunction };
