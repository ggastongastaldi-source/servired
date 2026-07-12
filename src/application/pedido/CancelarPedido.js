'use strict';

class CancelarPedido {
  constructor(uow) { this._uow = uow; }

  async execute({ pedidoId, motivo = '', ctx }) {
    const pedido = await this._uow._repo.findById(pedidoId);
    if (!pedido) throw new Error(`CancelarPedido: pedido ${pedidoId} no encontrado`);

    pedido.cancelar(motivo);
    await this._uow.commit(pedido, ctx);
    return { pedidoId };
  }
}

module.exports = { CancelarPedido };
