'use strict';

/**
 * UnitOfWork — coordina persistencia + publicación de eventos.
 *
 * Contrato:
 *   1. repo.save(pedido)              — persiste primero
 *   2. publicar(pedido.eventos, ctx)  — publica solo si save() no lanzó
 *   3. pedido.limpiarEventos()        — limpia siempre al final
 *
 * Si save() lanza → no se publican eventos (consistencia garantizada).
 * El publicador es inyectable → testeable sin Mongoose ni Nexus.
 */
class UnitOfWork {
  /**
   * @param {import('../../domain/pedido/repository/PedidoRepository').PedidoRepository} repo
   * @param {Function} publicar  fn(eventos, ctx) — e.g. publicarEventosDePedido
   */
  constructor(repo, publicar) {
    if (typeof publicar !== 'function')
      throw new Error('UnitOfWork: publicar debe ser una función');
    this._repo     = repo;
    this._publicar = publicar;
  }

  /**
   * @param {import('../../domain/pedido/Pedido').Pedido} pedido
   * @param {object} [ctx]  contexto de correlación { correlationId, rootCauseId }
   */
  async commit(pedido, ctx = {}) {
    const eventos = pedido.eventos;   // captura ANTES de limpiar

    // 1. Persistir — si falla, lanza y no se publican eventos
    await this._repo.save(pedido);

    // 2. Publicar — fire-and-forget por contrato del bus; errores logueados internamente
    this._publicar(eventos, ctx);

    // 3. Limpiar eventos del aggregate
    pedido.limpiarEventos();
  }
}

module.exports = { UnitOfWork };
