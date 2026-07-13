'use strict';

const assert = require('node:assert/strict');
const Module = require('module');

// ── Stubs ─────────────────────────────────────────────────────────────
const mongoStore = new Map();
let reactorLlamado = false;

const originalLoad = Module._load.bind(Module);
Module._load = function(request, parent, isMain) {
  if (request.includes('MongoPedidoRepository')) {
    return {
      MongoPedidoRepository: class {
        async findDocByJobId(jobId) {
          const doc = mongoStore.get(jobId);
          return doc ?? null;
        }
      }
    };
  }
  if (request.includes('PedidoProjectionReactor')) {
    return {
      proyectarPedido: async () => {},
      reaccionar: async (evento) => {
        reactorLlamado = true;
        mongoStore.set(evento.aggregateId, {
          _id:          'mongo-oid-123',
          jobId:        evento.aggregateId,
          tipoServicio: evento.payload.tipoServicio,
          zona:         evento.payload.zona,
          estado:       'PENDIENTE',
          toObject()    { return this; }
        });
      }
    };
  }
  if (request.includes('SinapsisEventAdapter')) {
    return { publicarEventosDePedido: () => {} };
  }
  return originalLoad(request, parent, isMain);
};

const { crearJobDesdeREST } = require('../../../src/infrastructure/adapters/CreateJobAdapter');

async function run() {
  console.log('TEST: crearJobDesdeREST — contrato de salida');

  const doc = await crearJobDesdeREST({
    clienteId:   'c-001',
    tipoServicio:'plomeria',
    zona:        'AMBA-SUR',
    precio:      5000,
    pagoWorker:  3500,
  });

  assert.ok(doc,              'devuelve doc');
  assert.ok(doc._id,          'doc tiene _id');
  assert.ok(doc.jobId,        'doc tiene jobId');
  assert.ok(reactorLlamado,   'reactor fue invocado');
  assert.ok(typeof doc.toObject === 'function', 'doc tiene .toObject()');
  console.log('  ✓ adapter devuelve doc Mongoose-compatible');

  console.log('\n✅ CreateJobAdapter tests pasaron');
}

Module._load = originalLoad;
run().catch(e => { console.error(e); process.exit(1); });
