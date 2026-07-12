'use strict';

class AsignarWorker {
  constructor(uow) { this._uow = uow; }

  async execute({ pedidoId, workerId, ctx }) {
    const pedido = await this._uow._repo.findById(pedidoId);
    if (!pedido) throw new Error(`AsignarWorker: pedido ${pedidoId} no encontrado`);

    if (pedido.estado.valor === 'PENDIENTE')  pedido.iniciarBusqueda();
    if (pedido.estado.valor === 'SEARCHING')  pedido.expandirBusqueda();

    pedido.asignarWorker(workerId);
    await this._uow.commit(pedido, ctx);
    return { pedidoId, workerId };
  }
}

module.exports = { AsignarWorker };
