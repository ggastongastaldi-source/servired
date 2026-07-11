'use strict';

const ESTADOS = Object.freeze([
  'PENDIENTE','SEARCHING','EXPANDING_RADIUS',
  'ACEPTADA','EN_PROCESO','REALIZADA','CERRADA','CANCELADA'
]);

const TRANSICIONES = Object.freeze({
  PENDIENTE:        ['SEARCHING','CANCELADA'],
  SEARCHING:        ['EXPANDING_RADIUS','ACEPTADA','CANCELADA'],
  EXPANDING_RADIUS: ['ACEPTADA','CANCELADA'],
  ACEPTADA:         ['EN_PROCESO','CANCELADA'],
  EN_PROCESO:       ['REALIZADA','CANCELADA'],
  REALIZADA:        ['CERRADA'],
  CERRADA:          [],
  CANCELADA:        []
});

class EstadoPedido {
  constructor(valor) {
    if (!ESTADOS.includes(valor))
      throw new Error(`EstadoPedido: estado inválido "${valor}"`);
    this._valor = valor;
    Object.freeze(this);
  }

  get valor() { return this._valor; }

  puedeTansicionarA(siguiente) {
    return TRANSICIONES[this._valor].includes(siguiente);
  }

  transicionarA(siguiente) {
    if (!this.puedeTansicionarA(siguiente))
      throw new Error(`EstadoPedido: transición inválida ${this._valor} → ${siguiente}`);
    return new EstadoPedido(siguiente);
  }

  esFinal() { return this._valor === 'CERRADA' || this._valor === 'CANCELADA'; }

  equals(otro) {
    return otro instanceof EstadoPedido && this._valor === otro._valor;
  }

  toString() { return this._valor; }

  static inicial() { return new EstadoPedido('PENDIENTE'); }
  static ESTADOS()  { return ESTADOS; }
}

module.exports = { EstadoPedido };
