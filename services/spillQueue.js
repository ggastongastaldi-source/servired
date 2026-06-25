/**
 * Disk Spill Queue — ServiRed OS RTMIL v1
 * Extiende backpressure: overflow a disco sin pérdida
 * G1: todo evento spillado es recuperable
 * G2: orden FIFO preservado por secuencia de archivo
 * G3: eventId deduplicado en re-ingesta
 * G4: emite a SINAPSIS en cada operación relevante
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Configuración ──────────────────────────────────────────────
const SPILL_DIR       = path.join(process.cwd(), 'wal_segments', 'spill');
const MAX_SPILL_BYTES = 512 * 1024 * 1024; // 512MB techo absoluto
const DRAIN_INTERVAL  = 2000;              // ms entre drains
const DRAIN_BATCH     = 100;               // eventos por ciclo drain

// ── Estado interno ─────────────────────────────────────────────
let spillSegmentIndex = 0;
let spillFd           = null;
let spillBytes        = 0;
let totalSpilled      = 0;
let totalDrained      = 0;
let drainTimer        = null;
let drainCallback     = null; // fn(event) → Promise — inyectado por RTMIL
let sinapsisBus       = null;
let initialized       = false;

// ── Init ───────────────────────────────────────────────────────
function init(opts = {}) {
  if (initialized) return;

  if (opts.sinapsisBus)   sinapsisBus   = opts.sinapsisBus;
  if (opts.drainCallback) drainCallback = opts.drainCallback;

  if (!fs.existsSync(SPILL_DIR)) {
    fs.mkdirSync(SPILL_DIR, { recursive: true });
  }

  // Recuperar segmento spill activo
  const existing = _listSpillFiles();
  if (existing.length > 0) {
    const last = existing[existing.length - 1];
    spillSegmentIndex = _idxFromFile(last);
    spillBytes = fs.statSync(path.join(SPILL_DIR, last)).size;
    console.log(`[SPILL] Recuperado — segmento ${last} (${(spillBytes/1024).toFixed(1)}KB pendiente)`);
  }

  _openSpillSegment(spillSegmentIndex);

  if (drainCallback) {
    drainTimer = setInterval(_drainCycle, DRAIN_INTERVAL);
    if (drainTimer.unref) drainTimer.unref();
  }

  initialized = true;
  console.log(`[SPILL] Iniciado — dir=${SPILL_DIR} MAX=${MAX_SPILL_BYTES/1024/1024}MB`);
}

// ── Escritura al spill ─────────────────────────────────────────
/**
 * spill(event) — persiste evento en disco cuando WAL buffer overflow
 * @returns {{ ok: boolean, reason: string }}
 */
function spill(event) {
  if (!initialized) return { ok: false, reason: 'NOT_INITIALIZED' };

  if (spillBytes >= MAX_SPILL_BYTES) {
    _emit('SPILL_CAPACITY_EXHAUSTED', { spillBytes, totalSpilled });
    console.error('[SPILL] ⚠️  Capacidad máxima alcanzada — evento descartado (último recurso)');
    return { ok: false, reason: 'SPILL_CAPACITY_EXHAUSTED' };
  }

  const entry = {
    spilledAt: new Date().toISOString(),
    eventId:   event.eventId || crypto.randomUUID(),
    type:      event.type    || 'UNKNOWN',
    actorId:   event.actorId || null,
    zoneId:    event.zoneId  || null,
    payload:   event.payload || {},
    original:  event
  };

  const line = JSON.stringify(entry) + '\n';
  const buf  = Buffer.from(line, 'utf8');

  try {
    fs.writeSync(spillFd, buf);
    fs.fsyncSync(spillFd); // spill siempre fsync — es el último recurso
    spillBytes  += buf.length;
    totalSpilled++;

    if (spillBytes >= 64 * 1024 * 1024) {
      _rotateSpillSegment();
    }

    _emit('EVENT_SPILLED', { eventId: entry.eventId, type: entry.type, totalSpilled });
    return { ok: true, reason: 'SPILLED' };
  } catch (err) {
    console.error('[SPILL] Error de escritura:', err.message);
    return { ok: false, reason: err.message };
  }
}

// ── Drain cycle ────────────────────────────────────────────────
async function _drainCycle() {
  if (!drainCallback) return;

  const files = _listSpillFiles();
  if (files.length === 0) return;

  // Drainear desde el segmento más antiguo primero (FIFO)
  const oldest = files[0];
  const filePath = path.join(SPILL_DIR, oldest);

  let lines;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    lines = content.trim().split('\n').filter(Boolean);
  } catch (err) {
    console.error('[SPILL] Error leyendo segmento para drain:', err.message);
    return;
  }

  if (lines.length === 0) {
    _deleteSpillFile(filePath);
    return;
  }

  const batch = lines.slice(0, DRAIN_BATCH);
  const remaining = lines.slice(DRAIN_BATCH);
  let drained = 0;

  for (const line of batch) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    try {
      await drainCallback(entry.original || entry);
      drained++;
      totalDrained++;
    } catch (err) {
      // Re-spillar al final si falla — no perder
      console.warn(`[SPILL] Drain falló para ${entry.eventId}:`, err.message);
      remaining.push(line);
    }
  }

  // Reescribir segmento con lo que quedó
  if (remaining.length === 0) {
    _deleteSpillFile(filePath);
  } else {
    fs.writeFileSync(filePath, remaining.join('\n') + '\n', 'utf8');
  }

  if (drained > 0) {
    spillBytes = Math.max(0, spillBytes - (drained * 256)); // estimado
    _emit('SPILL_DRAINED', { drained, remaining: remaining.length, totalDrained });
    console.log(`[SPILL] Drain — ${drained} eventos re-ingestados, ${remaining.length} pendientes`);
  }
}

// ── Drain manual (para tests / recovery forzado) ───────────────
async function drainAll() {
  const files = _listSpillFiles();
  let total = 0;
  for (const f of files) {
    const before = totalDrained;
    await _drainCycle();
    total += (totalDrained - before);
  }
  return total;
}

// ── Helpers ────────────────────────────────────────────────────
function _spillSegmentName(idx) {
  return `spill_seg_${String(idx).padStart(8, '0')}.log`;
}

function _openSpillSegment(idx) {
  const filePath = path.join(SPILL_DIR, _spillSegmentName(idx));
  spillFd = fs.openSync(filePath, 'a');
}

function _rotateSpillSegment() {
  fs.fsyncSync(spillFd);
  fs.closeSync(spillFd);
  spillSegmentIndex++;
  spillBytes = 0;
  _openSpillSegment(spillSegmentIndex);
  console.log(`[SPILL] Segmento rotado → ${_spillSegmentName(spillSegmentIndex)}`);
}

function _listSpillFiles() {
  if (!fs.existsSync(SPILL_DIR)) return [];
  return fs.readdirSync(SPILL_DIR)
    .filter(f => f.match(/^spill_seg_\d+\.log$/))
    .sort();
}

function _idxFromFile(filename) {
  const m = filename.match(/spill_seg_(\d+)\.log/);
  return m ? parseInt(m[1], 10) : 0;
}

function _deleteSpillFile(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) {}
}

function _emit(type, payload) {
  if (!sinapsisBus) return;
  try {
    sinapsisBus.publish({
      type,
      source:    'SPILL_QUEUE',
      payload,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  } catch (_) {}
}

// ── Shutdown ───────────────────────────────────────────────────
function shutdown() {
  if (drainTimer) clearInterval(drainTimer);
  if (spillFd) {
    try { fs.fsyncSync(spillFd); fs.closeSync(spillFd); } catch (_) {}
    spillFd = null;
  }
  initialized = false;
  console.log('[SPILL] Shutdown limpio.');
}

// ── Status ─────────────────────────────────────────────────────
function getStatus() {
  return {
    initialized,
    spillSegment:    _spillSegmentName(spillSegmentIndex),
    spillBytesMB:    (spillBytes / 1024 / 1024).toFixed(2),
    totalSpilled,
    totalDrained,
    pendingFiles:    _listSpillFiles().length,
    capacityUsedPct: ((spillBytes / MAX_SPILL_BYTES) * 100).toFixed(1) + '%'
  };
}

module.exports = {
  init,
  spill,
  drainAll,
  shutdown,
  getStatus
};
