'use strict';

class CancelarPedido {
  constructor(repo) { this._repo = repo; }

  async execute({ pedidoId, motivo = '' }) {
    const pedido = await this._repo.findById(pedidoId);
    if (!pedido) throw new Error(`CancelarPedido: pedido ${pedidoId} no encontrado`);

    pedido.cancelar(motivo);
    await this._repo.save(pedido);

    const eventos = pedido.eventos;
    pedido.limpiarEventos();
    return { pedidoId, eventos };
  }
}

module.exports = { CancelarPedido };
