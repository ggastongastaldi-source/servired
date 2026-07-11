'use strict';

class AsignarWorker {
  constructor(repo) { this._repo = repo; }

  async execute({ pedidoId, workerId }) {
    const pedido = await this._repo.findById(pedidoId);
    if (!pedido) throw new Error(`AsignarWorker: pedido ${pedidoId} no encontrado`);

    // Si está en PENDIENTE, avanzar por la FSM hasta EXPANDING_RADIUS
    if (pedido.estado.valor === 'PENDIENTE')       pedido.iniciarBusqueda();
    if (pedido.estado.valor === 'SEARCHING')        pedido.expandirBusqueda();

    pedido.asignarWorker(workerId);
    await this._repo.save(pedido);

    const eventos = pedido.eventos;
    pedido.limpiarEventos();
    return { pedidoId, workerId, eventos };
  }
}

module.exports = { AsignarWorker };
