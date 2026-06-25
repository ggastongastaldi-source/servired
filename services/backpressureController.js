/**
 * Backpressure Controller — ServiRed OS RTMIL v1
 * G1: eventos nunca perdidos (spill a disco)
 * G2: decisiones deterministas por thresholds
 * G3: admisión idempotente por eventId
 * G4: emite eventos SINAPSIS en cada transición de estado
 */

const crypto = require('crypto');

// ── Configuración ──────────────────────────────────────────────
const MAX_MEMORY_BUFFER  = 128 * 1024 * 1024; // 128MB
const MAX_QUEUE_DEPTH    = 250_000;
const SOFT_THRESHOLD     = 0.80;
const HARD_THRESHOLD     = 0.95;
const CRITICAL_TYPES     = new Set([
  'WORKER_ACCEPTED', 'WORKER_REJECTED', 'PAYMENT_CONFIRMED',
  'DIXIE_VIOLATION', 'SYSTEM_DEGRADED', 'AUDIT_EVENT'
]);

// ── Estado interno ─────────────────────────────────────────────
let memoryUsed    = 0;
let queueDepth    = 0;
let state         = 'OPEN';       // OPEN | THROTTLED | SATURATED
let admittedIds   = new Set();    // idempotencia en ventana corta
let sinapsisBus   = null;

const State = { OPEN: 'OPEN', THROTTLED: 'THROTTLED', SATURATED: 'SATURATED' };

// ── Init ───────────────────────────────────────────────────────
function init(opts = {}) {
  if (opts.sinapsisBus) sinapsisBus = opts.sinapsisBus;
  console.log('[BACKPRESSURE] Iniciado — MAX_BUFFER=128MB MAX_QUEUE=250k');
}

// ── Admisión ───────────────────────────────────────────────────
/**
 * admit(event) — decide si el evento puede ingresar al WAL
 * @returns {{ admitted: boolean, reason: string, spillRequired: boolean }}
 */
function admit(event) {
  const eventId = event.eventId || crypto.randomUUID();

  // G3: idempotencia — rechazar duplicado en ventana
  if (admittedIds.has(eventId)) {
    return { admitted: false, reason: 'DUPLICATE_EVENT_ID', spillRequired: false };
  }

  const memRatio   = _getMemoryRatio();
  const queueRatio = queueDepth / MAX_QUEUE_DEPTH;
  const isCritical = CRITICAL_TYPES.has(event.type);

  // Actualizar estado con transición
  _updateState(memRatio, queueRatio);

  if (state === State.SATURATED && !isCritical) {
    _emit('BACKPRESSURE_REJECTED', { eventId, type: event.type, memRatio, queueRatio });
    return { admitted: false, reason: 'SATURATED_NON_CRITICAL', spillRequired: true };
  }

  if (queueDepth >= MAX_QUEUE_DEPTH) {
    _emit('BACKPRESSURE_SPILL_REQUIRED', { eventId, type: event.type });
    return { admitted: false, reason: 'QUEUE_OVERFLOW', spillRequired: true };
  }

  // Admitir
  admittedIds.add(eventId);
  if (admittedIds.size > 10_000) {
    // limpiar ventana — mantener solo últimos 5k
    const arr = [...admittedIds];
    admittedIds = new Set(arr.slice(arr.length - 5000));
  }

  queueDepth++;
  return { admitted: true, reason: 'OK', spillRequired: false, eventId };
}

// ── Registro de escritura completada ──────────────────────────
function onWriteComplete(byteCount = 0) {
  queueDepth = Math.max(0, queueDepth - 1);
  memoryUsed = Math.max(0, memoryUsed - byteCount);
}

// ── Registro de evento encolado en memoria ─────────────────────
function onEventBuffered(byteCount = 0) {
  memoryUsed += byteCount;
}

// ── Transición de estado ───────────────────────────────────────
function _updateState(memRatio, queueRatio) {
  const prev = state;

  if (memRatio >= HARD_THRESHOLD || queueRatio >= HARD_THRESHOLD) {
    state = State.SATURATED;
  } else if (memRatio >= SOFT_THRESHOLD || queueRatio >= SOFT_THRESHOLD) {
    state = State.THROTTLED;
  } else {
    state = State.OPEN;
  }

  if (state !== prev) {
    console.log(`[BACKPRESSURE] Transición: ${prev} → ${state} (mem=${(memRatio*100).toFixed(1)}% queue=${(queueRatio*100).toFixed(1)}%)`);
    _emit('BACKPRESSURE_STATE_CHANGE', { prev, current: state, memRatio, queueRatio });
  }
}

// ── Memoria ────────────────────────────────────────────────────
function _getMemoryRatio() {
  // Node.js heap como proxy del buffer en memoria
  const heapUsed  = process.memoryUsage().heapUsed;
  const heapTotal = process.memoryUsage().heapTotal;
  // Usar el mayor entre heap ratio y memoryUsed/MAX
  const heapRatio = heapUsed / heapTotal;
  const bufRatio  = memoryUsed / MAX_MEMORY_BUFFER;
  return Math.max(heapRatio, bufRatio);
}

// ── Emisión a SINAPSIS ─────────────────────────────────────────
function _emit(type, payload) {
  if (!sinapsisBus) return;
  try {
    sinapsisBus.publish({
      type,
      source:    'BACKPRESSURE_CONTROLLER',
      payload,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  } catch (_) {}
}

// ── Status ─────────────────────────────────────────────────────
function getStatus() {
  const memRatio   = _getMemoryRatio();
  const queueRatio = queueDepth / MAX_QUEUE_DEPTH;
  return {
    state,
    memoryUsedMB:    (memoryUsed / 1024 / 1024).toFixed(2),
    memRatioPct:     (memRatio * 100).toFixed(1) + '%',
    queueDepth,
    queueRatioPct:   (queueRatio * 100).toFixed(1) + '%',
    admittedIdsSize: admittedIds.size
  };
}

module.exports = {
  init,
  admit,
  onWriteComplete,
  onEventBuffered,
  getStatus,
  State
};
