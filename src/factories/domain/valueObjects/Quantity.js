'use strict';
/**
 * Quantity — Value Object inmutable.
 * Representa una cantidad con unidad de medida.
 */
const VALID_UNITS = ['UNIDAD', 'KG', 'TON', 'LITRO', 'METRO', 'M2', 'M3', 'CAJA', 'PALLET'];

class Quantity {
  #value;
  #unit;

  constructor(value, unit) {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`Quantity: value "${value}" debe ser un número no negativo`);
    }
    if (!VALID_UNITS.includes(unit)) {
      throw new Error(`Quantity: unidad "${unit}" inválida. Válidas: ${VALID_UNITS.join(', ')}`);
    }
    this.#value = v;
    this.#unit  = unit;
    Object.freeze(this);
  }

  get value() { return this.#value; }
  get unit()  { return this.#unit; }

  add(other) {
    this.#assertSameUnit(other);
    return new Quantity(this.#value + other.value, this.#unit);
  }

  isGreaterThanOrEqual(other) {
    this.#assertSameUnit(other);
    return this.#value >= other.value;
  }

  equals(other) {
    return other instanceof Quantity &&
      other.value === this.#value &&
      other.unit === this.#unit;
  }

  #assertSameUnit(other) {
    if (!(other instanceof Quantity) || other.unit !== this.#unit) {
      throw new Error(`Quantity: unidades incompatibles (${this.#unit} vs ${other?.unit})`);
    }
  }

  static get VALID_UNITS() { return [...VALID_UNITS]; }

  toString() { return `${this.#value} ${this.#unit}`; }
}

module.exports = { Quantity, VALID_UNITS };
