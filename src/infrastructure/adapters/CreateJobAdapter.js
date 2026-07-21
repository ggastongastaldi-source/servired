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
const { reaccionar: reaccionarPedido } = require('../reactors/PedidoProjectionReactor');
const { publicarEventosDePedido } = require('../events/SinapsisEventAdapter');
// SR-NEURO-005: enriquecer envelope con synthesis y confidence del Nodo-C
const { analyze: marketFieldAnalyze } = require('../../../services/marketField/marketFieldEngine');

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
  // SR-NEURO-005: sintetizar inteligencia territorial antes de emitir
  let synapticCtx = {};
  try {
    const mf = await marketFieldAnalyze({ zoneId: zona, rubro: tipoServicio });
    synapticCtx = { confidence: mf.confidence, synthesis: mf.synthesis };
  } catch(_) { /* degradacion segura: sin enriquecimiento */ }

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
  try {
    await reaccionarPedido(eventos[0]);
  } catch(reactorErr) {
    throw new Error('[CreateJobAdapter] Reactor falló: ' + reactorErr.message + ' | stack: ' + (reactorErr.stack||'').split('\n').slice(0,3).join(' | '));
  }
  // SR-NEURO-005: re-publicar JOB_CREATED enriquecido con Synaptic Atom fields
  // El UnitOfWork ya publicó el evento base; aqui emitimos el atomo enriquecido
  // si hay datos de sintesis disponibles — el bus es idempotente por eventId
  if (synapticCtx.synthesis) {
    try {
      const { emitEvent } = require('../../../nexus/events/emitEvent');
      emitEvent({
        entityType:    'pedido',
        type:          'JOB_ATOM_SYNTHESIZED',
        aggregateId:   jobId,
        payload:       { clienteId, tipoServicio, zona, precio },
        correlationId: correlationId ?? jobId,
        confidence:    synapticCtx.confidence ?? null,
        synthesis:     synapticCtx.synthesis  ?? null,
      });
    } catch(_) { /* degradacion segura */ }
  }

  // Recuperar doc Mongoose para que el resto de pedidos.js funcione igual
  const doc = await getMongoRepo().findDocByJobId(jobId);
  if (!doc) throw new Error(`[CreateJobAdapter] Doc no encontrado para jobId ${jobId}`);
  return doc;
}

module.exports = { crearJobDesdeREST };
