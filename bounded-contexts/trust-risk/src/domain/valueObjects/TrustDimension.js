const BASE_DIMENSIONS = ['IDENTITY','DEVICE','BEHAVIOR','ECONOMIC','NETWORK'];
const EXTENDED_DIMENSIONS = ['SOCIAL','COMPLIANCE','MARKETPLACE','AI_CONFIDENCE','COMMERCE'];
const ALL_DIMENSIONS = [...BASE_DIMENSIONS, ...EXTENDED_DIMENSIONS];

class TrustDimension {
  constructor(value) {
    if (!ALL_DIMENSIONS.includes(value)) {
      throw new Error(`Unknown TrustDimension: ${value}. Known: ${ALL_DIMENSIONS.join(', ')}`);
    }
    this._value = value;
    Object.freeze(this);
  }
  get value() { return this._value; }
  isBase() { return BASE_DIMENSIONS.includes(this._value); }
  equals(other) { return other instanceof TrustDimension && this._value === other.value; }
  toString() { return this._value; }
  static of(value) { return new TrustDimension(value); }
  static IDENTITY   = new TrustDimension('IDENTITY');
  static DEVICE     = new TrustDimension('DEVICE');
  static BEHAVIOR   = new TrustDimension('BEHAVIOR');
  static ECONOMIC   = new TrustDimension('ECONOMIC');
  static NETWORK    = new TrustDimension('NETWORK');
  static BASE_SET   = BASE_DIMENSIONS.map(d => new TrustDimension(d));
  static ALL        = ALL_DIMENSIONS;
}

module.exports = { TrustDimension, BASE_DIMENSIONS, ALL_DIMENSIONS };
