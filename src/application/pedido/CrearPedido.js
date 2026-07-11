'use strict';

const { Pedido }  = require('../../domain/pedido/Pedido');
const { Dinero }  = require('../../domain/shared/value-objects/Dinero');

class CrearPedido {
  /** @param {import('../../domain/pedido/repository/PedidoRepository').PedidoRepository} repo */
  constructor(repo) { this._repo = repo; }

  /**
   * @param {{ clienteId, tipoServicio, zona, descripcion?, precio, pagoWorker }} cmd
   * @returns {{ pedidoId: string, eventos: object[] }}
   */
  async execute({ clienteId, tipoServicio, zona, descripcion, precio, pagoWorker }) {
    const pedido = Pedido.crear({
      clienteId,
      tipoServicio,
      zona,
      descripcion,
      precio:     new Dinero(precio),
      pagoWorker: new Dinero(pagoWorker),
    });

    await this._repo.save(pedido);
    const eventos = pedido.eventos;
    pedido.limpiarEventos();
    return { pedidoId: pedido.id, eventos };
  }
}

module.exports = { CrearPedido };
