const VALUES = ['IMPROVING','STABLE','DEGRADING'];

class Trend {
  constructor(value) {
    if (!VALUES.includes(value)) throw new Error(`Invalid Trend: ${value}`);
    this._value = value;
    Object.freeze(this);
  }
  get value() { return this._value; }
  static fromDeltas(deltas) {
    if (!deltas.length) return Trend.STABLE;
    const sum = deltas.reduce((a, b) => a + b, 0);
    if (sum > 0) return Trend.IMPROVING;
    if (sum < 0) return Trend.DEGRADING;
    return Trend.STABLE;
  }
  equals(other) { return other instanceof Trend && this._value === other.value; }
  toString() { return this._value; }
  static IMPROVING = new Trend('IMPROVING');
  static STABLE    = new Trend('STABLE');
  static DEGRADING = new Trend('DEGRADING');
}

module.exports = { Trend };
