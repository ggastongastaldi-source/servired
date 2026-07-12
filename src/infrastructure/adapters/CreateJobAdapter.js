'use strict';

/**
 * CreateJobAdapter — Etapa 1 del Strangler Fig
 *
 * Expone una función con la misma firma de efecto que el bloque legacy:
 *   new Pedido({...}) → save() → pedidoGuardado (doc Mongoose)
 *
 * Internamente usa:
 *   CreateJobCommandHandler → jobId
 *   PedidoProjectionReactor → persiste Pedido con jobId
 *   MongoPedidoRepository.findDocByJobId(jobId) → doc Mongoose
 *
 * El caller (pedidos.js) recibe el mismo doc Mongoose que antes.
 * No conoce nada del dominio DDD.
 */

const { CreateJobCommand }        = require('../../application/job/CreateJobCommand');
const { CreateJobCommandHandler } = require('../../application/job/CreateJobCommandHandler');
const { UnitOfWork }              = require('../../application/shared/UnitOfWork');
const { MongoPedidoRepository }   = require('../persistence/MongoPedidoRepository');
const { PedidoProjectionReactor } = require('../reactors/PedidoProjectionReactor');
const { publicarEventosDePedido } = require('../events/SinapsisEventAdapter');

// Singletons — se inicializan una vez
let _handler = null;
let _repo    = null;

function getHandler() {
  if (!_handler) {
    _repo    = new MongoPedidoRepository();
    const uow = new UnitOfWork(_repo, publicarEventosDePedido);
    _handler  = new CreateJobCommandHandler(uow);
  }
  return _handler;
}

/**
 * @param {object} params — mismos campos que el bloque legacy de pedidos.js
 * @returns {Promise<object>} documento Mongoose (mismo que pedidoGuardado antes)
 */
async function crearJobDesdeREST({
  clienteId,
  tipoServicio,
  zona,
  descripcion  = '',
  direccion    = '',
  complejidad  = 'baja',
  precio,
  pagoWorker,
  ubicacion    = null,
  correlationId = null,
}) {
  const cmd = new CreateJobCommand({
    clienteId,
    tipoServicio,
    zona,
    descripcion,
    precio,
    pagoWorker,
    source: 'REST',
    correlationId,
  });

  const handler = getHandler();
  const { jobId } = await handler.execute(cmd);

  // Reactor persiste el Pedido legacy con jobId
  const eventos = [{ type: 'JobCreated', aggregateId: jobId, payload: {
    clienteId, tipoServicio, zona, descripcion, direccion,
    complejidad, precio, pagoWorker, ubicacion,
  }}];
  await PedidoProjectionReactor.reaccionar(eventos[0]);

  // Recuperar doc Mongoose para que el resto de pedidos.js funcione igual
  const doc = await _repo.findDocByJobId(jobId);
  if (!doc) throw new Error(`[CreateJobAdapter] Doc no encontrado para jobId ${jobId}`);
  return doc;
}

module.exports = { crearJobDesdeREST };
