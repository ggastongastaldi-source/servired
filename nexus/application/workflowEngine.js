// ServiRed — Workflow Engine v1.0
// EVENT → REDUCER → SNAPSHOT
// Principios 1, 7, 9 del prompt maestro

const mongoose = require('mongoose');
const crypto = require('crypto');
const { emitEvent } = require('../events/emitEvent');

// ── REDUCERS DETERMINISTAS ──────────────────────────────────
// Puros, idempotentes, sin side effects
// Mismos eventos → mismo estado SIEMPRE

const REDUCERS = {
  pedido: (state = {}, event) => {
    switch (event.type) {
      case 'PEDIDO_CREADO':
        return { ...state, ...event.payload, estado: 'PENDIENTE', version: (state.version||0)+1 };
      case 'PEDIDO_ACEPTADO':
        return { ...state, estado: 'ACEPTADA', trabajadorId: event.payload.trabajadorId, aceptadoAt: event.timestamp, version: (state.version||0)+1 };
      case 'PEDIDO_EN_PROCESO':
        return { ...state, estado: 'EN_PROCESO', iniciadoAt: event.timestamp, version: (state.version||0)+1 };
      case 'PEDIDO_REALIZADO':
        return { ...state, estado: 'REALIZADA', realizadoAt: event.timestamp, version: (state.version||0)+1 };
      case 'PEDIDO_PAGADO':
        return { ...state, estado: 'PAGADA', pagadoAt: event.timestamp, paymentId: event.payload.paymentId, version: (state.version||0)+1 };
      case 'PEDIDO_CANCELADO':
        return { ...state, estado: 'CANCELADO', canceladoAt: event.timestamp, motivo: event.payload.motivo, version: (state.version||0)+1 };
      default:
        return state;
    }
  },

  worker: (state = {}, event) => {
    switch (event.type) {
      case 'WORKER_REGISTRADO':
        return { ...state, ...event.payload, estado: 'PENDIENTE_VERIFICACION', version: (state.version||0)+1 };
      case 'WORKER_VERIFICADO':
        return { ...state, estado: 'VERIFICADO', verificadoAt: event.timestamp, version: (state.version||0)+1 };
      case 'WORKER_RECHAZADO':
        return { ...state, estado: 'RECHAZADO', rechazadoAt: event.timestamp, version: (state.version||0)+1 };
      case 'WORKER_ONLINE':
        return { ...state, disponible: true, lastOnline: event.timestamp, version: (state.version||0)+1 };
      case 'WORKER_OFFLINE':
        return { ...state, disponible: false, lastOffline: event.timestamp, version: (state.version||0)+1 };
      default:
        return state;
    }
  },

  cliente: (state = {}, event) => {
    switch (event.type) {
      case 'CLIENTE_REGISTRADO':
        return { ...state, ...event.payload, estado: 'ACTIVO', version: (state.version||0)+1 };
      case 'CLIENTE_PEDIDO_CREADO':
        return { ...state, totalPedidos: (state.totalPedidos||0)+1, version: (state.version||0)+1 };
      default:
        return state;
    }
  },
};

// ── SNAPSHOT ENGINE ─────────────────────────────────────────
// Guarda y recupera snapshots con checksum para detectar divergencia

async function saveSnapshot(entityType, aggregateId, state) {
  const checksum = crypto.createHash('sha256')
    .update(JSON.stringify(state))
    .digest('hex').slice(0, 16);

  await mongoose.connection.collection('snapshots').updateOne(
    { entityType, aggregateId },
    { $set: {
      entityType,
      aggregateId,
      state,
      checksum,
      version: state.version || 0,
      savedAt: new Date(),
    }},
    { upsert: true }
  );
  return checksum;
}

async function loadSnapshot(entityType, aggregateId) {
  return mongoose.connection.collection('snapshots')
    .findOne({ entityType, aggregateId });
}

// ── REPLAY ENGINE ────────────────────────────────────────────
// Reconstruye estado desde eventos — recovery determinista

async function replay(entityType, aggregateId, fromVersion = 0) {
  const reducer = REDUCERS[entityType];
  if (!reducer) throw new Error(`Sin reducer para: ${entityType}`);

  // Cargar snapshot base si existe
  let state = {};
  let startVersion = 0;

  if (fromVersion === 0) {
    const snap = await loadSnapshot(entityType, aggregateId);
    if (snap) {
      state = snap.state;
      startVersion = snap.version || 0;
      console.log(`[WorkflowEngine] 📸 Snapshot cargado: ${entityType}/${aggregateId} v${startVersion}`);
    }
  }

  // Cargar eventos posteriores al snapshot
  const events = await mongoose.connection.collection('events')
    .find({
      entityType,
      aggregateId: String(aggregateId),
      'metadata.workflowVersion': { $exists: true },
    })
    .sort({ timestamp: 1 })
    .toArray();

  const eventsToApply = events.filter(e => (e.payload?.version || 0) > startVersion);

  console.log(`[WorkflowEngine] 🔄 Replay: ${eventsToApply.length} eventos para ${entityType}/${aggregateId}`);

  for (const event of eventsToApply) {
    state = reducer(state, event);
  }

  return state;
}

// ── APPEND EVENT ─────────────────────────────────────────────
// Única forma de mutar estado — EVENT → REDUCER → SNAPSHOT

async function appendEvent(entityType, aggregateId, type, payload, ctx = {}) {
  const reducer = REDUCERS[entityType];
  if (!reducer) throw new Error(`Sin reducer para: ${entityType}`);

  // Cargar estado actual
  const snap = await loadSnapshot(entityType, aggregateId);
  const currentState = snap?.state || {};

  // Aplicar reducer (puro, determinista)
  const event = {
    type,
    payload,
    timestamp: new Date(),
    aggregateId: String(aggregateId),
    entityType,
  };
  const newState = reducer(currentState, event);

  // Persistir evento en Nexus
  emitEvent({
    entityType,
    type,
    aggregateId: String(aggregateId),
    payload,
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    rootCauseId: ctx.rootCauseId,
  });

  // Guardar snapshot cada 10 versiones o siempre en eventos críticos
  const criticalEvents = ['PEDIDO_PAGADO', 'WORKER_VERIFICADO', 'PEDIDO_CANCELADO'];
  if ((newState.version % 10 === 0) || criticalEvents.includes(type)) {
    const checksum = await saveSnapshot(entityType, aggregateId, newState);
    console.log(`[WorkflowEngine] 💾 Snapshot guardado: ${entityType}/${aggregateId} v${newState.version} [${checksum}]`);
  }

  return newState;
}

// ── INTEGRITY CHECK ──────────────────────────────────────────
// Detecta divergencia entre snapshot y replay

async function checkIntegrity(entityType, aggregateId) {
  const snap = await loadSnapshot(entityType, aggregateId);
  if (!snap) return { ok: true, reason: 'no_snapshot' };

  const replayed = await replay(entityType, aggregateId, 0);
  const replayedChecksum = crypto.createHash('sha256')
    .update(JSON.stringify(replayed))
    .digest('hex').slice(0, 16);

  const ok = snap.checksum === replayedChecksum;
  if (!ok) {
    console.error(`[WorkflowEngine] ⚠️ DIVERGENCIA: ${entityType}/${aggregateId} snap:${snap.checksum} replay:${replayedChecksum}`);
    emitEvent({
      entityType: 'system',
      type: 'SNAPSHOT_DIVERGENCE_DETECTED',
      aggregateId: `${entityType}_${aggregateId}`,
      payload: { snapshotChecksum: snap.checksum, replayChecksum: replayedChecksum },
    });
  }
  return { ok, snapshotChecksum: snap.checksum, replayChecksum: replayedChecksum };
}

module.exports = { appendEvent, replay, saveSnapshot, loadSnapshot, checkIntegrity, REDUCERS };
