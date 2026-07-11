'use strict';

const assert = require('node:assert/strict');

const { PedidoRepository } = require('../../../src/domain/pedido/repository/PedidoRepository');
const { CrearPedido }      = require('../../../src/application/pedido/CrearPedido');
const { AsignarWorker }    = require('../../../src/application/pedido/AsignarWorker');
const { CancelarPedido }   = require('../../../src/application/pedido/CancelarPedido');
const { LiberarPago }      = require('../../../src/application/pedido/LiberarPago');

// ── Repositorio en memoria (test double) ─────────────────────────────
class InMemoryPedidoRepository extends PedidoRepository {
  constructor() { super(); this._store = new Map(); }
  async save(p)        { this._store.set(p.id, p); }
  async findById(id)   { return this._store.get(id) ?? null; }
  async exists(id)     { return this._store.has(id); }
  async findPendientes(){ return [...this._store.values()].filter(p => p.estado.valor === 'PENDIENTE'); }
}

const CMD_BASE = {
  clienteId:    'cliente-001',
  tipoServicio: 'electricidad',
  zona:         'AMBA-SUR',
  precio:       8000,
  pagoWorker:   5500,
};

async function run() {
  // ── CrearPedido ───────────────────────────────────────────────────
  console.log('TEST: CrearPedido');
  const repo  = new InMemoryPedidoRepository();
  const crear = new CrearPedido(repo);
  const r1    = await crear.execute(CMD_BASE);

  assert.ok(r1.pedidoId,               'pedidoId generado');
  assert.equal(r1.eventos.length, 1,   'emitió 1 evento');
  assert.equal(r1.eventos[0].type, 'PedidoCreado', 'tipo PedidoCreado');
  assert.ok(await repo.exists(r1.pedidoId), 'persistido en repo');

  const guardado = await repo.findById(r1.pedidoId);
  assert.equal(guardado.estado.valor, 'PENDIENTE', 'estado PENDIENTE');
  assert.equal(guardado.precio.monto, 8000,        'precio correcto');
  console.log('  ✓ CrearPedido');

  // ── AsignarWorker ─────────────────────────────────────────────────
  console.log('TEST: AsignarWorker');
  const asignar = new AsignarWorker(repo);
  const r2      = await asignar.execute({ pedidoId: r1.pedidoId, workerId: 'worker-007' });

  assert.equal(r2.workerId, 'worker-007', 'workerId ok');
  const asignado = await repo.findById(r1.pedidoId);
  assert.equal(asignado.estado.valor, 'ACEPTADA', 'estado ACEPTADA');
  assert.ok(r2.eventos.some(e => e.type === 'PedidoAsignado'), 'evento PedidoAsignado');
  console.log('  ✓ AsignarWorker');

  // ── CancelarPedido ────────────────────────────────────────────────
  console.log('TEST: CancelarPedido');
  const repo2    = new InMemoryPedidoRepository();
  const r3       = await new CrearPedido(repo2).execute(CMD_BASE);
  const cancelar = new CancelarPedido(repo2);
  const r4       = await cancelar.execute({ pedidoId: r3.pedidoId, motivo: 'test' });

  const cancelado = await repo2.findById(r3.pedidoId);
  assert.equal(cancelado.estado.valor, 'CANCELADA', 'estado CANCELADA');
  assert.ok(r4.eventos.some(e => e.type === 'PedidoCancelado'), 'evento PedidoCancelado');
  console.log('  ✓ CancelarPedido');

  // ── LiberarPago ───────────────────────────────────────────────────
  console.log('TEST: LiberarPago');
  const repo3 = new InMemoryPedidoRepository();
  const r5    = await new CrearPedido(repo3).execute(CMD_BASE);
  const pid   = r5.pedidoId;

  await new AsignarWorker(repo3).execute({ pedidoId: pid, workerId: 'w1' });
  const p = await repo3.findById(pid);
  p.iniciarTrabajo();
  p.finalizarTrabajo();
  await repo3.save(p);

  const r6 = await new LiberarPago(repo3).execute({ pedidoId: pid });
  assert.equal(r6.monto, 5500, 'monto pagoWorker ok');
  assert.ok(r6.eventos.some(e => e.type === 'PagoLiberado'), 'evento PagoLiberado');
  const cerrado = await repo3.findById(pid);
  assert.equal(cerrado.estado.valor, 'CERRADA', 'estado CERRADA');
  console.log('  ✓ LiberarPago');

  // ── Pedido no encontrado ──────────────────────────────────────────
  console.log('TEST: pedido inexistente');
  await assert.rejects(
    () => new AsignarWorker(repo3).execute({ pedidoId: 'no-existe', workerId: 'w' }),
    /no encontrado/
  );
  console.log('  ✓ pedido inexistente lanza error');

  console.log('\n✅ Todos los tests del Bloque 3 pasaron');
}

run().catch(e => { console.error(e); process.exit(1); });
