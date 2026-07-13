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

// Repositorio en memoria para el Aggregate — el Pedido legacy lo persiste el Reactor
// MongoPedidoRepository solo se usa para findDocByJobId al final
class InMemoryJobRepo {
  constructor() { this._store = new Map(); }
  async save(p)      { this._store.set(p.id, p); }
  async findById(id) { return this._store.get(id) ?? null; }
  async exists(id)   { return this._store.has(id); }
}

function getMongoRepo() {
  return new MongoPedidoRepository();
}

function getHandler() {
  const memRepo = new InMemoryJobRepo();
  const uow     = new UnitOfWork(memRepo, publicarEventosDePedido);
  return new CreateJobCommandHandler(uow);
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
  const doc = await getMongoRepo().findDocByJobId(jobId);
  if (!doc) throw new Error(`[CreateJobAdapter] Doc no encontrado para jobId ${jobId}`);
  return doc;
}

module.exports = { crearJobDesdeREST };
