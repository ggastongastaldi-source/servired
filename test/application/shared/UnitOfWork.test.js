'use strict';

const assert = require('node:assert/strict');
const { UnitOfWork } = require('../../../src/application/shared/UnitOfWork');
const { Pedido }     = require('../../../src/domain/pedido/Pedido');
const { Dinero }     = require('../../../src/domain/shared/value-objects/Dinero');

// ── Doubles ───────────────────────────────────────────────────────────
class RepoOk {
  constructor() { this.guardados = []; }
  async save(p) { this.guardados.push(p.id); }
  async findById() { return null; }
}

class RepoFalla {
  async save() { throw new Error('DB caída'); }
}

function pedidoBase() {
  return Pedido.crear({
    clienteId: 'c1', tipoServicio: 'gas', zona: 'AMBA-NORTE',
    precio: new Dinero(4000), pagoWorker: new Dinero(2800),
  });
}

// ── Test 1: orden save → publicar → limpiar ───────────────────────────
console.log('TEST: orden de operaciones');
(async () => {
  const log = [];
  const repo = {
    async save(p) { log.push('save:' + p.id); },
  };
  const publicar = (evs) => { log.push('publicar:' + evs.length); };

  const uow   = new UnitOfWork(repo, publicar);
  const pedido = pedidoBase();
  const id     = pedido.id;

  assert.equal(pedido.eventos.length, 1, 'tiene 1 evento antes del commit');
  await uow.commit(pedido);

  assert.equal(log[0], 'save:' + id,   'save fue primero');
  assert.equal(log[1], 'publicar:1',    'publicar fue segundo');
  assert.equal(pedido.eventos.length, 0,'eventos limpiados después del commit');
  console.log('  ✓ orden correcto');

// ── Test 2: si save() falla → no se publican eventos ──────────────────
  console.log('TEST: save falla → no publica');
  const publicaciones = [];
  const uow2  = new UnitOfWork(new RepoFalla(), (evs) => publicaciones.push(evs));
  const p2    = pedidoBase();

  await assert.rejects(() => uow2.commit(p2), /DB caída/);
  assert.equal(publicaciones.length, 0, 'no se publicó nada');
  assert.equal(p2.eventos.length, 1,    'eventos intactos en el aggregate');
  console.log('  ✓ save falla → no publica');

// ── Test 3: ctx de correlación se propaga al publicador ───────────────
  console.log('TEST: ctx propagado');
  let ctxRecibido;
  const uow3 = new UnitOfWork(
    { async save() {} },
    (evs, ctx) => { ctxRecibido = ctx; }
  );
  const p3 = pedidoBase();
  await uow3.commit(p3, { correlationId: 'corr-xyz', rootCauseId: 'root-1' });
  assert.equal(ctxRecibido.correlationId, 'corr-xyz', 'correlationId propagado');
  assert.equal(ctxRecibido.rootCauseId,   'root-1',   'rootCauseId propagado');
  console.log('  ✓ ctx propagado');

// ── Test 4: casos de uso refactorizados usan UnitOfWork ───────────────
  console.log('TEST: CrearPedido con UoW');
  const { CrearPedido }  = require('../../../src/application/pedido/CrearPedido');
  const { AsignarWorker } = require('../../../src/application/pedido/AsignarWorker');

  const store = new Map();
  const repoMem = {
    async save(p)      { store.set(p.id, p); },
    async findById(id) { return store.get(id) ?? null; },
  };
  const eventos_publicados = [];
  const uow4 = new UnitOfWork(repoMem, (evs) => eventos_publicados.push(...evs));

  const r1 = await new CrearPedido(uow4).execute({
    clienteId: 'c1', tipoServicio: 'pintura', zona: 'AMBA-SUR',
    precio: 6000, pagoWorker: 4000,
  });
  assert.ok(r1.pedidoId,                   'pedidoId generado');
  assert.equal(eventos_publicados.length, 1,'CrearPedido publicó 1 evento');
  assert.equal(eventos_publicados[0].type, 'PedidoCreado', 'tipo ok');

  await new AsignarWorker(uow4).execute({ pedidoId: r1.pedidoId, workerId: 'w99' });
  assert.ok(eventos_publicados.some(e => e.type === 'PedidoAsignado'), 'AsignarWorker publicó evento');
  console.log('  ✓ CrearPedido + AsignarWorker con UoW');

  console.log('\n✅ Todos los tests del Bloque 5 pasaron');
})().catch(e => { console.error(e); process.exit(1); });
