/**
 * RTMIL Ingest Layer — ServiRed OS RTMIL v1
 * Ensambla: BackpressureController → WAL Writer → SpillQueue
 * Punto único de entrada para todos los eventos del sistema
 * G1: ningún evento admitido se pierde
 * G2: orden de ingesta preservado en WAL
 * G3: idempotencia delegada a backpressure (eventId)
 * G4: trazabilidad completa via SINAPSIS
 */

const wal         = require('./walWriter');
const backpressure = require('./backpressureController');
const spill       = require('./spillQueue');

let sinapsisBus  = null;
let initialized  = false;

// ── Init ───────────────────────────────────────────────────────
function init(opts = {}) {
  if (initialized) return;

  sinapsisBus = opts.sinapsisBus || null;

  wal.init({
    durabilityMode: opts.durabilityMode || wal.DurabilityMode.SAFE
  });

  backpressure.init({ sinapsisBus });

  spill.init({
    sinapsisBus,
    drainCallback: _reIngest
  });

  initialized = true;
  console.log('[RTMIL] Ingest Layer activo — WAL + Backpressure + Spill ensamblados');
}

// ── Ingest principal ───────────────────────────────────────────
/**
 * ingest(event) — punto único de entrada
 * @param {object} event — { type, actorId?, zoneId?, payload?, eventId? }
 * @returns {Promise<{ ok, seq?, checksum?, segment?, reason }>}
 */
async function ingest(event) {
  if (!initialized) throw new Error('[RTMIL] No inicializado. Llamar init() primero.');

  // 1. Admisión por backpressure
  const admission = backpressure.admit(event);

  if (!admission.admitted) {
    if (admission.spillRequired) {
      const spillResult = spill.spill(event);
      _emit('RTMIL_EVENT_SPILLED', {
        eventId: event.eventId,
        type:    event.type,
        reason:  admission.reason,
        spilled: spillResult.ok
      });
      return { ok: false, reason: admission.reason, spilled: spillResult.ok };
    }
    return { ok: false, reason: admission.reason, spilled: false };
  }

  // 2. Estimar tamaño para contabilidad de memoria
  const estimatedBytes = Buffer.byteLength(JSON.stringify(event), 'utf8');
  backpressure.onEventBuffered(estimatedBytes);

  // 3. Escribir en WAL
  try {
    const result = await wal.append(event);
    backpressure.onWriteComplete(estimatedBytes);

    _emit('RTMIL_EVENT_INGESTED', {
      eventId:  admission.eventId,
      type:     event.type,
      seq:      result.seq,
      segment:  result.segment
    });

    return { ok: true, ...result };
  } catch (err) {
    backpressure.onWriteComplete(estimatedBytes);

    // WAL falló — spillar como último recurso
    console.error('[RTMIL] WAL write error — spillando:', err.message);
    const spillResult = spill.spill(event);
    _emit('RTMIL_WAL_ERROR_SPILL', {
      eventId: event.eventId,
      type:    event.type,
      error:   err.message,
      spilled: spillResult.ok
    });

    return { ok: false, reason: 'WAL_ERROR', spilled: spillResult.ok };
  }
}

// ── Re-ingesta desde spill (drain callback) ────────────────────
async function _reIngest(event) {
  // Bypass backpressure solo si sistema está OPEN
  const status = backpressure.getStatus();
  if (status.state === 'SATURATED') {
    throw new Error('SYSTEM_SATURATED'); // SpillQueue reintentará
  }
  return ingest(event);
}

// ── Emit a SINAPSIS ────────────────────────────────────────────
function _emit(type, payload) {
  if (!sinapsisBus) return;
  try {
    sinapsisBus.publish({
      type,
      source:    'RTMIL_INGEST',
      payload,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  } catch (_) {}
}

// ── Shutdown ───────────────────────────────────────────────────
function shutdown() {
  spill.shutdown();
  wal.shutdown();
  initialized = false;
  console.log('[RTMIL] Shutdown completo.');
}

// ── Status ─────────────────────────────────────────────────────
function getStatus() {
  return {
    initialized,
    wal:          wal.getStatus(),
    backpressure: backpressure.getStatus(),
    spill:        spill.getStatus()
  };
}

module.exports = { init, ingest, shutdown, getStatus };
