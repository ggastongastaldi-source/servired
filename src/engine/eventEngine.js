const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ─── FSM: transiciones válidas ────────────────────────────────────────────────
const FSM_TRANSITIONS = {
  PEDIDO_CREADO:        { from: null,              to: 'PENDIENTE'        },
  BUSQUEDA_INICIADA:    { from: 'PENDIENTE',       to: 'SEARCHING'        },
  RADIO_EXPANDIDO:      { from: 'SEARCHING',       to: 'EXPANDING_RADIUS' },
  WORKER_ASIGNADO:      { from: ['SEARCHING','EXPANDING_RADIUS'], to: 'ACEPTADA' },
  TRABAJO_INICIADO:     { from: 'ACEPTADA',        to: 'EN_PROCESO'       },
  TRABAJO_REALIZADO:    { from: 'EN_PROCESO',      to: 'REALIZADA'        },
  PAGO_APROBADO:        { from: 'REALIZADA',       to: 'PAGADA'           },
  PEDIDO_CANCELADO:     { from: ['PENDIENTE','SEARCHING','EXPANDING_RADIUS','ACEPTADA'], to: 'CANCELADA' }
};

// ─── Filtro FSM para MongoDB findOneAndUpdate ─────────────────────────────────
function getFSMFilter(jobId, eventType) {
  const t = FSM_TRANSITIONS[eventType];
  if (!t) throw new Error(`[EventEngine] Evento desconocido: ${eventType}`);
  const filter = { _id: jobId };
  if (t.from !== null) {
    filter.estado = Array.isArray(t.from) ? { $in: t.from } : t.from;
  }
  return filter;
}

// ─── Snapshot determinístico ──────────────────────────────────────────────────
function getTransitionSnapshot(eventType, metadata = {}) {
  const t = FSM_TRANSITIONS[eventType];
  if (!t) throw new Error(`[EventEngine] Transición desconocida: ${eventType}`);
  const snap = { estado: t.to };
  if (metadata.workerId)      snap.worker       = metadata.workerId;
  if (metadata.precio)        snap.precio        = metadata.precio;
  if (metadata.total_estimado) snap.total_estimado = metadata.total_estimado;
  if (metadata.pago_worker)   snap.pago_worker   = metadata.pago_worker;
  return snap;
}

// ─── Core: emitJobEvent ───────────────────────────────────────────────────────
async function emitJobEvent(jobId, { type, source, idempotencyKey, metadata = {} }, io = null) {
  const t0 = Date.now();
  const eventId = uuidv4();
  const key = idempotencyKey || `${jobId}:${type}:${eventId}`;

  let filter, snapshot;
  try {
    filter   = getFSMFilter(jobId, type);
    snapshot = getTransitionSnapshot(type, metadata);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', eventId, jobId, type, error: err.message }));
    return { ok: false, reason: err.message };
  }

  // Idempotencia: rechazar si ya existe este key en el timeline
  filter['timeline.idempotencyKey'] = { $ne: key };

  const update = {
    $set: snapshot,
    $push: {
      timeline: { eventId, type, source, at: new Date(), idempotencyKey: key, metadata },
      historialEstados: { estado: snapshot.estado, fecha: new Date(), nota: `${type} via ${source}` }
    }
  };

  const Pedido = mongoose.model('Pedido');
  const result = await Pedido.findOneAndUpdate(filter, update, { new: true });

  const latencyMs = Date.now() - t0;

  if (!result) {
    const log = { level: 'warn', eventId, jobId, type, source, latencyMs, rejectionReason: 'FSM_REJECTED_OR_DUPLICATE' };
    console.warn(JSON.stringify(log));
    return { ok: false, reason: 'FSM_REJECTED_OR_DUPLICATE', eventId };
  }

  const log = { level: 'info', eventId, jobId, type, source, transitionTo: snapshot.estado, latencyMs };
  console.log(JSON.stringify(log));

  // Radiación Socket.IO
  if (io) {
    const payload = { snapshot: result, lastEvent: { eventId, type, at: new Date() } };
    io.to('admins').emit('job_update', payload);
    if (result.cliente) io.to(`client_${result.cliente}`).emit('job_update', payload);
    if (result.worker)  io.to(`worker_${result.worker}`).emit('job_update', payload);
  }

  return { ok: true, eventId, estado: snapshot.estado, job: result };
}

module.exports = { emitJobEvent, FSM_TRANSITIONS };
