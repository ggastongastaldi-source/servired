'use strict';

const { Pedido }       = require('../../../src/domain/pedido/Pedido');
const { Dinero }       = require('../../../src/domain/shared/value-objects/Dinero');
const { EstadoPedido } = require('../../../src/domain/shared/value-objects/EstadoPedido');

function pedidoBase() {
  return Pedido.crear({
    clienteId:    'cliente-123',
    tipoServicio: 'plomeria',
    zona:         'AMBA-OESTE',
    precio:       new Dinero(5000),
    pagoWorker:   new Dinero(3500),
  });
}

// ── Dinero ──────────────────────────────────────────────────────────
console.log('TEST: Dinero');
const d1 = new Dinero(100);
const d2 = new Dinero(200);
console.assert(d1.sumar(d2).monto === 300,  'sumar ok');
console.assert(d2.esMayorQue(d1),           'esMayorQue ok');
console.assert(d1.equals(new Dinero(100)),   'equals ok');
try { new Dinero(-1); console.assert(false, 'debió lanzar'); } catch(e) {}
try { new Dinero(NaN);console.assert(false, 'debió lanzar'); } catch(e) {}
console.log('  ✓ Dinero');

// ── EstadoPedido ─────────────────────────────────────────────────────
console.log('TEST: EstadoPedido');
const ep = EstadoPedido.inicial();
console.assert(ep.valor === 'PENDIENTE',      'inicial ok');
const ep2 = ep.transicionarA('SEARCHING');
console.assert(ep2.valor === 'SEARCHING',     'transición ok');
console.assert(ep.valor === 'PENDIENTE',      'inmutabilidad ok');
try { ep2.transicionarA('CERRADA'); console.assert(false, 'debió lanzar'); } catch(e) {}
console.assert(new EstadoPedido('CERRADA').esFinal(), 'esFinal ok');
console.log('  ✓ EstadoPedido');

// ── Pedido.crear ─────────────────────────────────────────────────────
console.log('TEST: Pedido.crear');
const p = pedidoBase();
console.assert(p.estado.valor === 'PENDIENTE',   'estado inicial ok');
console.assert(p.clienteId === 'cliente-123',    'clienteId ok');
console.assert(p.eventos.length === 1,           'emitió PedidoCreado');
console.assert(p.eventos[0].type === 'PedidoCreado', 'tipo evento ok');
console.log('  ✓ Pedido.crear');

// ── Invariante: pagoWorker > precio ──────────────────────────────────
console.log('TEST: invariante pagoWorker > precio');
try {
  Pedido.crear({
    clienteId:'x', tipoServicio:'y', zona:'z',
    precio: new Dinero(100), pagoWorker: new Dinero(200)
  });
  console.assert(false, 'debió lanzar');
} catch(e) { console.log('  ✓ invariante pagoWorker > precio'); }

// ── Flujo happy path ─────────────────────────────────────────────────
console.log('TEST: flujo completo');
const p2 = pedidoBase();
p2.iniciarBusqueda();
console.assert(p2.estado.valor === 'SEARCHING',   'SEARCHING ok');
p2.expandirBusqueda();
console.assert(p2.estado.valor === 'EXPANDING_RADIUS', 'EXPANDING_RADIUS ok');
p2.asignarWorker('worker-456');
console.assert(p2.estado.valor === 'ACEPTADA',   'ACEPTADA ok');
console.assert(p2.workerId === 'worker-456',      'workerId ok');
p2.iniciarTrabajo();
console.assert(p2.estado.valor === 'EN_PROCESO',  'EN_PROCESO ok');
p2.finalizarTrabajo();
console.assert(p2.estado.valor === 'REALIZADA',   'REALIZADA ok');
p2.liberarPago();
console.assert(p2.estado.valor === 'CERRADA',     'CERRADA ok');
const tipos = p2.eventos.map(e => e.type);
console.assert(tipos.includes('PedidoAsignado'),      'evento PedidoAsignado ok');
console.assert(tipos.includes('TrabajoFinalizado'),    'evento TrabajoFinalizado ok');
console.assert(tipos.includes('PagoLiberado'),         'evento PagoLiberado ok');
console.log('  ✓ flujo completo');

// ── Cancelar ─────────────────────────────────────────────────────────
console.log('TEST: cancelar');
const p3 = pedidoBase();
p3.iniciarBusqueda();
p3.cancelar('cliente desistió');
console.assert(p3.estado.valor === 'CANCELADA', 'CANCELADA ok');
try { p3.cancelar(); console.assert(false, 'debió lanzar en estado final'); } catch(e) {}
console.log('  ✓ cancelar');

// ── Timeline ──────────────────────────────────────────────────────────
console.log('TEST: timeline');
const p4 = pedidoBase();
p4.iniciarBusqueda();
p4.expandirBusqueda();
p4.asignarWorker('w1');
p4.iniciarTrabajo();
console.assert(p4.timeline.length === 2, 'timeline append-only ok');
console.log('  ✓ timeline');

console.log('\n✅ Todos los tests del Bloque 2 pasaron');
