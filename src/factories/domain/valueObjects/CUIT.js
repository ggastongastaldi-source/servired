'use strict';
/**
 * CUIT — Value Object inmutable.
 * Formato válido: XX-XXXXXXXX-X (guiones opcionales en entrada).
 */
class CUIT {
  #value;

  constructor(raw) {
    const normalized = String(raw).replace(/-/g, '');
    if (!/^\d{11}$/.test(normalized)) {
      throw new Error(`CUIT inválido: "${raw}". Formato esperado: XX-XXXXXXXX-X`);
    }
    if (!CUIT.#validarDigitoVerificador(normalized)) {
      throw new Error(`CUIT inválido: dígito verificador incorrecto para "${raw}"`);
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  static #validarDigitoVerificador(digits) {
    const factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const sum = factors.reduce((acc, f, i) => acc + f * parseInt(digits[i]), 0);
    const remainder = sum % 11;
    if (remainder === 1) return false;
    const check = remainder === 0 ? 0 : 11 - remainder;
    return check === parseInt(digits[10]);
  }

  get value() { return this.#value; }

  formatted() {
    return `${this.#value.slice(0,2)}-${this.#value.slice(2,10)}-${this.#value.slice(10)}`;
  }

  equals(other) {
    return other instanceof CUIT && other.value === this.#value;
  }

  toString() { return this.formatted(); }
}

module.exports = { CUIT };
