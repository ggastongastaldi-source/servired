'use strict';
const { InvalidScoreRangeError } = require('../errors');

const BANDS = [
  { name: 'CRITICAL', min: 0,  max: 19  },
  { name: 'LOW',      min: 20, max: 39  },
  { name: 'MEDIUM',   min: 40, max: 59  },
  { name: 'HIGH',     min: 60, max: 79  },
  { name: 'FULL',     min: 80, max: 100 },
];

class TrustScore {
  constructor(value) {
    const n = Math.round(Number(value));
    if (isNaN(n) || n < 0 || n > 100) throw new InvalidScoreRangeError(value);
    Object.defineProperty(this, '_value', { value: n, writable: false, configurable: false });
    Object.freeze(this);
  }
  get value() { return this._value; }
  band() { return BANDS.find(b => this._value >= b.min && this._value <= b.max).name; }
  isAbove(threshold) { return this._value > threshold; }
  isBelow(threshold) { return this._value < threshold; }
  apply(delta) { return new TrustScore(Math.min(100, Math.max(0, this._value + delta))); }
  equals(other) { return other instanceof TrustScore && this._value === other.value; }
  toString() { return `${this._value}(${this.band()})`; }
  static of(value) { return new TrustScore(value); }
}
TrustScore.INITIAL = new TrustScore(50);
TrustScore.MIN     = new TrustScore(0);
TrustScore.MAX     = new TrustScore(100);

module.exports = { TrustScore, BANDS };
