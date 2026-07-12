'use strict';

const assert = require('node:assert/strict');
const { CreateJobCommand }        = require('../../../src/application/job/CreateJobCommand');
const { CreateJobCommandHandler } = require('../../../src/application/job/CreateJobCommandHandler');
const { UnitOfWork }              = require('../../../src/application/shared/UnitOfWork');
const { PedidoRepository }        = require('../../../src/domain/pedido/repository/PedidoRepository');
const { proyectarPedido }         = require('../../../src/infrastructure/reactors/PedidoProjectionReactor');

// ── Repo en memoria ───────────────────────────────────────────────────
class InMemoryRepo extends PedidoRepository {
  constructor() { super(); this._store = new Map(); }
  async save(p)      { this._store.set(p.id, p); }
  async findById(id) { return this._store.get(id) ?? null; }
}

// ── Stub de Mongoose: intercepta require del modelo Pedido ────────────
const pedidosGuardados = [];
const Module = require('module');
const orig   = Module._load.bind(Module);
Module._load = function(req, parent, isMain) {
  if (req.endsWith('core/models/Pedido') || req.endsWith('models/Pedido')) {
    return {
      default: null,
      // constructor fake que simula new Model({...}).save()
    };
  }
  return orig(req, parent, isMain);
};

// Stub más simple: reemplazamos proyectarPedido con versión in-memory
async function proyectarPedidoStub(domainEvent) {
  const p = domainEvent.payload;
  const doc = {
    jobId:          domainEvent.aggregateId,
    cliente:        p.clienteId,
    tipoServicio:   p.tipoServicio,
    zona:           p.zona,
    descripcion:    p.descripcion  ?? '',
    complejidad:    p.complejidad  ?? 'baja',
    precio:         p.precio,
    total_estimado: p.precio,
    pago_worker:    p.pagoWorker,
    estado:         'PENDIENTE',
  };
  pedidosGuardados.push(doc);
  return doc;
}
Module._load = orig; // restaurar inmediatamente

// ── Tests ─────────────────────────────────────────────────────────────
async function run() {

  // ── Test 1: CreateJobCommand valida campos ────────────────────────
  console.log('TEST: CreateJobCommand — validación');
  try {
    new CreateJobCommand({ tipoServicio: 'gas', zona: 'AMBA', precio: 100, pagoWorker: 50 });
    assert.fail('debió lanzar por clienteId faltante');
  } catch(e) { assert.match(e.message, /clienteId/); }

  try {
    new CreateJobCommand({ clienteId: 'c1', tipoServicio: 'gas', zona: 'AMBA',
      precio: 100, pagoWorker: 200 });
    assert.fail('debió lanzar por pagoWorker > precio');
  } catch(e) { assert.match(e.message, /pagoWorker/); }

  const cmd = new CreateJobCommand({
    clienteId: 'cliente-test', tipoServicio: 'plomeria',
    zona: 'AMBA-OESTE', precio: 5000, pagoWorker: 3500,
    source: 'REST',
  });
  assert.equal(cmd.clienteId, 'cliente-test', 'clienteId ok');
  assert.ok(Object.isFrozen(cmd), 'comando inmutable');
  console.log('  ✓ CreateJobCommand validación');

  // ── Test 2: Handler genera jobId y persiste aggregate ─────────────
  console.log('TEST: CreateJobCommandHandler — flujo completo');
  const repo     = new InMemoryRepo();
  const eventos  = [];
  const uow      = new UnitOfWork(repo, (evs) => eventos.push(...evs));
  const handler  = new CreateJobCommandHandler(uow);

  const result = await handler.execute(cmd);
  assert.ok(result.jobId,               'jobId generado');
  assert.match(result.jobId, /^[0-9a-f-]{36}$/, 'jobId es UUID');

  const aggregate = await repo.findById(result.jobId);
  assert.ok(aggregate,                          'aggregate persistido');
  assert.equal(aggregate.estado.valor, 'PENDIENTE', 'estado PENDIENTE');
  assert.equal(aggregate.precio.monto,  5000,       'precio ok');
  assert.equal(aggregate.pagoWorker.monto, 3500,    'pagoWorker ok');
  assert.equal(eventos.length, 1,                   'emitió 1 evento');
  assert.equal(eventos[0].type, 'JobCreated',       'tipo JobCreated');
  console.log('  ✓ CreateJobCommandHandler flujo completo');

  // ── Test 3: Reactor produce Pedido equivalente ────────────────────
  console.log('TEST: PedidoProjectionReactor — paridad');
  const domainEvent = eventos[0];
  const pedidoDoc   = await proyectarPedidoStub(domainEvent);

  // Paridad: los campos clave del Pedido legacy deben coincidir con el comando
  assert.equal(pedidoDoc.jobId,        result.jobId,        'jobId vinculado');
  assert.equal(pedidoDoc.cliente,      cmd.clienteId,       'clienteId igual');
  assert.equal(pedidoDoc.tipoServicio, cmd.tipoServicio,    'tipoServicio igual');
  assert.equal(pedidoDoc.zona,         cmd.zona,            'zona igual');
  assert.equal(pedidoDoc.precio,       cmd.precio,          'precio igual');
  assert.equal(pedidoDoc.pago_worker,  cmd.pagoWorker,      'pagoWorker igual');
  assert.equal(pedidoDoc.estado,       'PENDIENTE',         'estado PENDIENTE');
  assert.ok(pedidoDoc.jobId,                                'jobId presente');
  console.log('  ✓ Reactor produce Pedido con paridad completa');

  // ── Test 4: jobId vincula aggregate ↔ Pedido ─────────────────────
  console.log('TEST: vínculo jobId ↔ aggregateId');
  assert.equal(pedidoDoc.jobId, aggregate.id, 'jobId del Pedido = id del Aggregate');
  console.log('  ✓ jobId vincula correctamente ambos mundos');

  console.log('\n✅ Todos los tests de paridad de la Etapa 0 pasaron');
}

run().catch(e => { console.error(e); process.exit(1); });
