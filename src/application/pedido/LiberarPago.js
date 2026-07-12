'use strict';

class LiberarPago {
  constructor(repo) { this._repo = repo; }

  async execute({ pedidoId }) {
    const pedido = await this._repo.findById(pedidoId);
    if (!pedido) throw new Error(`LiberarPago: pedido ${pedidoId} no encontrado`);

    pedido.liberarPago();
    await this._repo.save(pedido);

    const eventos = pedido.eventos;
    pedido.limpiarEventos();
    return { pedidoId, monto: pedido.pagoWorker.monto, eventos };
  }
}

module.exports = { LiberarPago };
