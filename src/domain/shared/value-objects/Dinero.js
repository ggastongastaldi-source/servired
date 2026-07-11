'use strict';

class Dinero {
  constructor(monto, moneda = 'ARS') {
    if (typeof monto !== 'number' || isNaN(monto) || monto < 0)
      throw new Error(`Dinero: monto inválido (${monto})`);
    if (typeof moneda !== 'string' || moneda.trim() === '')
      throw new Error('Dinero: moneda inválida');
    this._monto  = monto;
    this._moneda = moneda.trim().toUpperCase();
    Object.freeze(this);
  }

  get monto()  { return this._monto;  }
  get moneda() { return this._moneda; }

  sumar(otro) {
    this._mismaMoneda(otro);
    return new Dinero(this._monto + otro._monto, this._moneda);
  }

  esMayorQue(otro) {
    this._mismaMoneda(otro);
    return this._monto > otro._monto;
  }

  equals(otro) {
    return otro instanceof Dinero &&
      this._monto === otro._monto &&
      this._moneda === otro._moneda;
  }

  toString() { return `${this._moneda} ${this._monto.toFixed(2)}`; }

  _mismaMoneda(otro) {
    if (!(otro instanceof Dinero) || otro._moneda !== this._moneda)
      throw new Error(`Dinero: monedas incompatibles (${this._moneda} vs ${otro?._moneda})`);
  }
}

module.exports = { Dinero };
