'use strict';

class Percentage {
  constructor(value) {
    const n = Number(value);
    if (isNaN(n) || n < 0 || n > 1) throw new RangeError(`Percentage must be 0.0-1.0, got ${value}`);
    const v = Math.round(n * 1e10) / 1e10;
    Object.defineProperty(this, '_value', { value: v, writable: false, configurable: false });
    Object.freeze(this);
  }
  get value() { return this._value; }
  add(other) { return new Percentage(Math.min(1, this._value + other.value)); }
  subtract(other) { return new Percentage(Math.max(0, this._value - other.value)); }
  multiply(factor) { return new Percentage(Math.min(1, this._value * factor)); }
  equals(other) { return other instanceof Percentage && Math.abs(this._value - other.value) < 1e-9; }
  toString() { return `${(this._value * 100).toFixed(1)}%`; }
  static of(value) { return new Percentage(value); }
}
Percentage.ZERO = new Percentage(0);
Percentage.ONE  = new Percentage(1);

module.exports = { Percentage };
