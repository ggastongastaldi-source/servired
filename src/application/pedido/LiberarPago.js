'use strict';

class LiberarPago {
  constructor(uow) { this._uow = uow; }

  async execute({ pedidoId, ctx }) {
    const pedido = await this._uow._repo.findById(pedidoId);
    if (!pedido) throw new Error(`LiberarPago: pedido ${pedidoId} no encontrado`);

    pedido.liberarPago();
    await this._uow.commit(pedido, ctx);
    return { pedidoId, monto: pedido.pagoWorker.monto };
  }
}

module.exports = { LiberarPago };
