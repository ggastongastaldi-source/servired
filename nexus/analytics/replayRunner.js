// Nexus Replay Runner v1.0
// Reconstruye projections desde EventStore append-only
// drop projections → replay → mismo resultado determinístico
const mongoose = require('mongoose');

// ── Projection handlers por tipo de evento ────────────────
const handlers = {

  JOB_CREATED: async (event) => {
    await mongoose.connection.collection('proj_jobs').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          aggregateId:  event.aggregateId,
          rubro:        event.payload.rubro        || 'desconocida',
          zona:         event.payload.zona         || 'desconocida',
          precio:       event.payload.precio       || 0,
          clienteId:    event.payload.clienteId    || null,
          estado:       'CREADO',
          creadoEn:     event.timestamp,
          ultimoEvento: event.type,
          updatedAt:    new Date()
      }},
      { upsert: true }
    );
  },

  JOB_ASSIGNED: async (event) => {
    await mongoose.connection.collection('proj_jobs').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          workerId:     event.payload.workerId || null,
          estado:       'ASIGNADO',
          asignadoEn:   event.timestamp,
          ultimoEvento: event.type,
          updatedAt:    new Date()
      }}
    );
  },

  JOB_STARTED: async (event) => {
    await mongoose.connection.collection('proj_jobs').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          estado:       'EN_PROCESO',
          iniciadoEn:   event.timestamp,
          ultimoEvento: event.type,
          updatedAt:    new Date()
      }}
    );
  },

  JOB_COMPLETED: async (event) => {
    await mongoose.connection.collection('proj_jobs').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          estado:         'COMPLETADO',
          completadoEn:   event.timestamp,
          ultimoEvento:   event.type,
          updatedAt:      new Date()
      }}
    );
    // Actualizar metrica de zona/rubro
    await mongoose.connection.collection('proj_zona_metrics').updateOne(
      { zona: event.payload.zona || 'desconocida', rubro: event.payload.rubro || 'desconocida' },
      { $inc: { completados: 1, ingresoTotal: event.payload.precio || 0 },
        $set: { updatedAt: new Date() },
        $setOnInsert: { zona: event.payload.zona, rubro: event.payload.rubro, createdAt: new Date() }
      },
      { upsert: true }
    );
  },

  JOB_PAID: async (event) => {
    await mongoose.connection.collection('proj_jobs').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          estado:       'PAGADO',
          pagadoEn:     event.timestamp,
          ultimoEvento: event.type,
          updatedAt:    new Date()
      }}
    );
  },

  JOB_CANCELED: async (event) => {
    await mongoose.connection.collection('proj_jobs').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          estado:        'CANCELADO',
          canceladoEn:   event.timestamp,
          ultimoEvento:  event.type,
          updatedAt:     new Date()
      }}
    );
  },

  LEAD_RECEIVED: async (event) => {
    await mongoose.connection.collection('proj_leads').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          aggregateId:  event.aggregateId,
          rubro:        event.payload.rubro  || 'desconocida',
          zona:         event.payload.zona   || 'desconocida',
          source:       event.payload.source || 'manual',
          estado:       'RECEIVED',
          creadoEn:     event.timestamp,
          ultimoEvento: event.type,
          updatedAt:    new Date()
      }},
      { upsert: true }
    );
  },

  LEAD_ASSIGNED: async (event) => {
    await mongoose.connection.collection('proj_leads').updateOne(
      { aggregateId: event.aggregateId },
      { $set: {
          estado:       'ASSIGNED',
          asignadoEn:   event.timestamp,
          ultimoEvento: event.type,
          updatedAt:    new Date()
      }}
    );
  }
};

// ── Core del Replay ───────────────────────────────────────

async function replay({ desde, hasta, borrarProjections = false, verbose = false } = {}) {
  console.log('[Replay] 🔄 Iniciando replay...');
  const startMs = Date.now();

  // Drop opcional de projections
  if (borrarProjections) {
    await mongoose.connection.collection('proj_jobs').deleteMany({});
    await mongoose.connection.collection('proj_leads').deleteMany({});
    await mongoose.connection.collection('proj_zona_metrics').deleteMany({});
    console.log('[Replay] 🗑️  Projections limpiadas');
  }

  // Query al EventStore
  const query = {};
  if (desde || hasta) {
    query.timestamp = {};
    if (desde) query.timestamp.$gte = new Date(desde);
    if (hasta) query.timestamp.$lte = new Date(hasta);
  }

  const eventos = await mongoose.connection.collection('events')
    .find(query)
    .sort({ timestamp: 1 })  // orden cronológico estricto
    .toArray();

  console.log(`[Replay] 📦 ${eventos.length} eventos a procesar`);

  let procesados = 0, errores = 0, omitidos = 0;

  for (const evento of eventos) {
    const handler = handlers[evento.type];
    if (!handler) {
      omitidos++;
      if (verbose) console.log(`[Replay] ⏭️  Sin handler: ${evento.type}`);
      continue;
    }
    try {
      await handler(evento);
      procesados++;
      if (verbose) console.log(`[Replay] ✅ ${evento.type} | ${evento.aggregateId}`);
    } catch(e) {
      errores++;
      console.error(`[Replay] ❌ Error en ${evento.type}:`, e.message);
    }
  }

  const duracionMs = Date.now() - startMs;
  const resultado = { procesados, errores, omitidos, total: eventos.length, duracionMs };
  console.log('[Replay] ✅ Completado:', JSON.stringify(resultado));
  return resultado;
}

module.exports = { replay, handlers };
