'use strict';

const { randomUUID } = require('crypto');
const { Pedido }     = require('../../domain/pedido/Pedido');
const { Dinero }     = require('../../domain/shared/value-objects/Dinero');

/**
 * CreateJobCommandHandler
 *
 * Orquesta: validación → Aggregate → UnitOfWork → return { jobId, eventos }
 * NO conoce Mongo, Pedido legacy, ni SINAPSIS directamente.
 * El publicador de eventos se inyecta via UnitOfWork.
 */
class CreateJobCommandHandler {
  /**
   * @param {import('../shared/UnitOfWork').UnitOfWork} uow
   */
  constructor(uow) {
    if (!uow || typeof uow.commit !== 'function')
      throw new Error('CreateJobCommandHandler: uow inválido');
    this._uow = uow;
  }

  /**
   * @param {import('./CreateJobCommand').CreateJobCommand} cmd
   * @returns {Promise<{ jobId: string }>}
   */
  async execute(cmd) {
    const jobId = randomUUID();

    const pedido = Pedido.crear({
      id:           jobId,
      clienteId:    cmd.clienteId,
      tipoServicio: cmd.tipoServicio,
      zona:         cmd.zona,
      descripcion:  cmd.descripcion,
      precio:       new Dinero(cmd.precio),
      pagoWorker:   new Dinero(cmd.pagoWorker),
    });

    await this._uow.commit(pedido, {
      correlationId: cmd.correlationId ?? jobId,
      rootCauseId:   jobId,
    });

    return { jobId };
  }
}

module.exports = { CreateJobCommandHandler };
