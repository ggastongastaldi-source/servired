'use strict';

class Money {
  #cents;
  #currency;

  constructor(cents, currency = 'ARS', __internal__ = false) {
    if (__internal__) {
      if (!Number.isInteger(cents) || cents < 0)
        throw new Error(`Money: cents="${cents}" debe ser entero no negativo`);
      this.#cents    = cents;
      this.#currency = currency;
    } else {
      const c = Math.round(Number(cents) * 100);
      if (!Number.isFinite(c) || c < 0)
        throw new Error(`Money: amount="${cents}" debe ser número no negativo`);
      if (typeof currency !== 'string' || currency.length !== 3)
        throw new Error(`Money: currency "${currency}" debe ser código ISO 4217`);
      this.#cents    = c;
      this.#currency = currency.toUpperCase();
    }
    Object.freeze(this);
  }

  static fromCents(cents, currency = 'ARS') {
    return new Money(cents, currency.toUpperCase(), true);
  }

  get amount()   { return this.#cents / 100; }
  get cents()    { return this.#cents; }
  get currency() { return this.#currency; }

  add(other) {
    this.#assertSameCurrency(other);
    return Money.fromCents(this.#cents + other.cents, this.#currency);
  }

  subtract(other) {
    this.#assertSameCurrency(other);
    const r = this.#cents - other.cents;
    if (r < 0) throw new Error('Money: resultado negativo no permitido');
    return Money.fromCents(r, this.#currency);
  }

  multiply(factor) {
    if (!Number.isFinite(factor) || factor < 0)
      throw new Error(`Money.multiply: factor "${factor}" inválido`);
    return Money.fromCents(Math.round(this.#cents * factor), this.#currency);
  }

  isGreaterThan(other) {
    this.#assertSameCurrency(other);
    return this.#cents > other.cents;
  }

  equals(other) {
    return other instanceof Money &&
      other.cents === this.#cents &&
      other.currency === this.#currency;
  }

  #assertSameCurrency(other) {
    if (!(other instanceof Money) || other.currency !== this.#currency)
      throw new Error(`Money: monedas distintas (${this.#currency} vs ${other?.currency})`);
  }

  toString() { return `${this.#currency} ${this.amount.toFixed(2)}`; }
}

module.exports = { Money };
