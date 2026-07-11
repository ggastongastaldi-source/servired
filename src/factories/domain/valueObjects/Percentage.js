'use strict';
/**
 * Percentage — Value Object inmutable.
 * Rango: 0 a 100 inclusive.
 * Usado para descuentos, márgenes, y tasas en CommercialPolicy.
 */
class Percentage {
  #value;

  constructor(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      throw new Error(`Percentage: "${value}" debe estar entre 0 y 100`);
    }
    this.#value = v;
    Object.freeze(this);
  }

  get value() { return this.#value; }

  asDecimal() { return this.#value / 100; }

  applyTo(money) {
    const { Money } = require('./Money');
    if (!(money instanceof Money)) throw new Error('Percentage.applyTo: requiere un Money');
    return money.multiply(this.asDecimal());
  }

  equals(other) {
    return other instanceof Percentage && other.value === this.#value;
  }

  toString() { return `${this.#value}%`; }
}

module.exports = { Percentage };
