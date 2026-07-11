'use strict';

const assert = require('node:assert/strict');
const path   = require('path');
const Module = require('module');

// ── Stub de nexus/events/emitEvent ───────────────────────────────────
// Interceptamos el require ANTES de cargar el adaptador
const llamadas = [];
const originalLoad = Module._load.bind(Module);
Module._load = function(request, parent, isMain) {
  if (request.includes('nexus/events/emitEvent') ||
      request.endsWith('emitEvent')) {
    return {
      emitEvent: (envelope) => { llamadas.push(envelope); }
    };
  }
  return originalLoad(request, parent, isMain);
};

const { publicarEventosDePedido } =
  require('../../src/infrastructure/events/SinapsisEventAdapter');

// ── helpers ───────────────────────────────────────────────────────────
function evento(type, aggregateId, payload = {}) {
  return { eventId: 'ev-' + Math.random(), type, aggregateId, payload };
}

// ── Test 1: mapeo correcto ────────────────────────────────────────────
console.log('TEST: mapeo PedidoCreado → PEDIDO_CREADO');
publicarEventosDePedido([evento('PedidoCreado', 'p-001', { zona: 'AMBA' })]);
assert.equal(llamadas.length, 1,              '1 llamada a emitEvent');
assert.equal(llamadas[0].type, 'PEDIDO_CREADO', 'tipo mapeado ok');
assert.equal(llamadas[0].entityType, 'pedido',  'entityType ok');
assert.equal(llamadas[0].aggregateId, 'p-001',  'aggregateId ok');
assert.equal(llamadas[0].payload.zona, 'AMBA',  'payload propagado');
console.log('  ✓ mapeo PedidoCreado');

// ── Test 2: causationId = eventId del dominio ─────────────────────────
console.log('TEST: causationId');
llamadas.length = 0;
const de = evento('PedidoAsignado', 'p-002', { workerId: 'w-1' });
publicarEventosDePedido([de], { correlationId: 'corr-abc' });
assert.equal(llamadas[0].causationId, de.eventId,       'causationId = eventId dominio');
assert.equal(llamadas[0].correlationId, 'corr-abc',     'correlationId propagado');
console.log('  ✓ causationId');

// ── Test 3: tipo no mapeado no lanza, solo warn ───────────────────────
console.log('TEST: tipo desconocido');
llamadas.length = 0;
publicarEventosDePedido([evento('EventoDesconocido', 'p-003')]);
assert.equal(llamadas.length, 0, 'tipo no mapeado no emite');
console.log('  ✓ tipo desconocido omitido sin error');

// ── Test 4: array vacío no lanza ──────────────────────────────────────
console.log('TEST: array vacío');
publicarEventosDePedido([]);
publicarEventosDePedido(null);
console.log('  ✓ array vacío / null sin error');

// ── Test 5: todos los tipos mapeados ─────────────────────────────────
console.log('TEST: todos los tipos');
llamadas.length = 0;
const tipos = ['PedidoCreado','PedidoAsignado','TrabajoIniciado',
                'TrabajoFinalizado','PedidoCancelado','PagoLiberado'];
publicarEventosDePedido(tipos.map(t => evento(t, 'p-999')));
assert.equal(llamadas.length, tipos.length, 'todos los tipos emiten');
console.log('  ✓ todos los tipos mapeados');

// Restaurar Module._load
Module._load = originalLoad;

console.log('\n✅ Todos los tests de SinapsisEventAdapter pasaron');
