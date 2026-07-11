'use strict';

const { Pedido }  = require('../../domain/pedido/Pedido');
const { Dinero }  = require('../../domain/shared/value-objects/Dinero');

class CrearPedido {
  /** @param {import('../shared/UnitOfWork').UnitOfWork} uow */
  constructor(uow) { this._uow = uow; }

  async execute({ clienteId, tipoServicio, zona, descripcion, precio, pagoWorker, ctx }) {
    const pedido = Pedido.crear({
      clienteId, tipoServicio, zona, descripcion,
      precio:     new Dinero(precio),
      pagoWorker: new Dinero(pagoWorker),
    });

    await this._uow.commit(pedido, ctx);
    return { pedidoId: pedido.id };
  }
}

module.exports = { CrearPedido };
