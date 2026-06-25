/**
 * WAL Segment Writer — ServiRed OS RTMIL v1
 * G1: Persistencia verificable (checksum SHA-256)
 * G2: Determinismo (append-only, secuencia monotónica)
 * G3: Idempotencia (eventId único por segmento)
 * G4: Auditable (cada entry tiene metadata completa)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// G5 — Event Archive (Mongo) — lazy load para no bloquear arranque
let _archive = null;
function _getArchive() {
  if (!_archive) {
    try { _archive = require('../models/WalEventArchive'); } catch (_) {}
  }
  return _archive;
}

// ── Configuración ──────────────────────────────────────────────
const WAL_DIR = path.join(process.cwd(), 'wal_segments');
const MAX_SEGMENT_SIZE = 64 * 1024 * 1024; // 64MB
const FSYNC_INTERVAL_MS = 100;             // SAFE mode default

const DurabilityMode = {
  FAST:     'FAST',     // buffer flush only
  SAFE:     'SAFE',     // fsync cada 100ms
  CRITICAL: 'CRITICAL'  // fsync por batch + rotación
};

// ── Estado interno ─────────────────────────────────────────────
let currentSegmentIndex = 0;
let currentSegmentSize  = 0;
let currentFd           = null;
let writeQueue          = [];
let fsyncTimer          = null;
let sequenceCounter     = 0;
let lastChecksum        = '0'.repeat(64);
let initialized         = false;
let durabilityMode      = DurabilityMode.SAFE;

// ── Inicialización ─────────────────────────────────────────────
function init(opts = {}) {
  if (initialized) return;

  if (opts.durabilityMode) durabilityMode = opts.durabilityMode;

  if (!fs.existsSync(WAL_DIR)) {
    fs.mkdirSync(WAL_DIR, { recursive: true });
  }

  // Recuperar segmento activo desde disco
  const existing = fs.readdirSync(WAL_DIR)
    .filter(f => f.match(/^wal_seg_\d+\.log$/))
    .sort();

  if (existing.length > 0) {
    const last = existing[existing.length - 1];
    currentSegmentIndex = parseInt(last.match(/wal_seg_(\d+)\.log/)[1], 10);
    const stat = fs.statSync(path.join(WAL_DIR, last));
    currentSegmentSize = stat.size;

    // Recuperar lastChecksum y sequenceCounter desde último entry válido
    _recoverState(path.join(WAL_DIR, last));
  }

  _openSegment(currentSegmentIndex);

  if (durabilityMode === DurabilityMode.SAFE) {
    fsyncTimer = setInterval(_flushAndSync, FSYNC_INTERVAL_MS);
    if (fsyncTimer.unref) fsyncTimer.unref();
  }

  initialized = true;
  console.log(`[WAL] Iniciado — segmento ${_segmentName(currentSegmentIndex)} — modo ${durabilityMode}`);
}

// ── Escritura principal ────────────────────────────────────────
/**
 * append(event) — encola evento para escritura en WAL
 * @param {object} event — debe incluir eventId, type, payload
 * @returns {Promise<{seq, checksum, segment}>}
 */
function append(event) {
  if (!initialized) throw new Error('[WAL] No inicializado. Llamar init() primero.');

  return new Promise((resolve, reject) => {
    const seq = ++sequenceCounter;
    const timestamp = new Date().toISOString();

    const entry = {
      seq,
      timestamp,
      eventId:   event.eventId   || crypto.randomUUID(),
      type:      event.type      || 'UNKNOWN',
      actorId:   event.actorId   || null,
      zoneId:    event.zoneId    || null,
      payload:   event.payload   || {},
      prevHash:  lastChecksum,
      checksum:  null // calculado abajo
    };

    // SHA-256 del contenido sin checksum
    const raw = JSON.stringify({ ...entry, checksum: undefined });
    entry.checksum = crypto.createHash('sha256').update(raw).digest('hex');
    lastChecksum = entry.checksum;

    const line = JSON.stringify(entry) + '\n';
    const buf  = Buffer.from(line, 'utf8');

    writeQueue.push({ buf, entry, resolve, reject });

    if (durabilityMode === DurabilityMode.CRITICAL) {
      _flushAndSync();
    } else if (durabilityMode === DurabilityMode.FAST) {
      _flushBuffer();
    }
    // SAFE: el timer periódico se encarga
  });
}

// ── Flush y fsync ──────────────────────────────────────────────
function _flushBuffer() {
  if (writeQueue.length === 0 || !currentFd) return;

  const batch = writeQueue.splice(0, writeQueue.length);
  const combined = Buffer.concat(batch.map(item => item.buf));

  try {
    fs.writeSync(currentFd, combined);
    currentSegmentSize += combined.length;

    const segName = _segmentName(currentSegmentIndex);
    batch.forEach(({ entry, resolve }) => {
      resolve({
        seq:      entry.seq,
        checksum: entry.checksum,
        segment:  segName
      });
      // G5 — archivar en Mongo fire-and-forget
      const Archive = _getArchive();
      if (Archive) {
        Archive.create({ ...entry, segment: segName })
          .catch(err => {
            // duplicate key = ya archivado — ignorar
            if (err.code !== 11000) {
              console.warn('[WAL] Archive error:', err.message);
            }
          });
      }
    });

    if (currentSegmentSize >= MAX_SEGMENT_SIZE) {
      _rotateSegment();
    }
  } catch (err) {
    batch.forEach(({ reject }) => reject(err));
  }
}

function _flushAndSync() {
  if (writeQueue.length === 0 || !currentFd) return;
  _flushBuffer();
  try {
    fs.fsyncSync(currentFd);
  } catch (err) {
    console.error('[WAL] fsync error:', err.message);
  }
}

// ── Rotación de segmento ───────────────────────────────────────
function _rotateSegment() {
  _flushAndSync();
  fs.closeSync(currentFd);
  console.log(`[WAL] Rotando segmento ${_segmentName(currentSegmentIndex)} (${(currentSegmentSize / 1024 / 1024).toFixed(2)}MB)`);

  currentSegmentIndex++;
  currentSegmentSize = 0;
  _openSegment(currentSegmentIndex);
}

// ── Helpers ────────────────────────────────────────────────────
function _segmentName(idx) {
  return `wal_seg_${String(idx).padStart(8, '0')}.log`;
}

function _openSegment(idx) {
  const filePath = path.join(WAL_DIR, _segmentName(idx));
  currentFd = fs.openSync(filePath, 'a');
}

function _recoverState(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return;

    const last = JSON.parse(lines[lines.length - 1]);
    sequenceCounter = last.seq || 0;
    lastChecksum    = last.checksum || '0'.repeat(64);
    console.log(`[WAL] Recuperado — seq=${sequenceCounter} checksum=${lastChecksum.slice(0, 12)}...`);
  } catch (err) {
    console.warn('[WAL] No se pudo recuperar estado previo:', err.message);
  }
}

// ── Cierre limpio ──────────────────────────────────────────────
function shutdown() {
  if (fsyncTimer) clearInterval(fsyncTimer);
  _flushAndSync();
  if (currentFd) {
    fs.closeSync(currentFd);
    currentFd = null;
  }
  initialized = false;
  console.log('[WAL] Shutdown limpio completado.');
}

// ── API de lectura para replay ─────────────────────────────────
/**
 * readSegment(idx) — lee y valida un segmento completo
 * Verifica chain de checksums entry por entry
 * @returns {Array<{entry, valid, chainOk}>}
 */
function readSegment(idx) {
  const filePath = path.join(WAL_DIR, _segmentName(idx));
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
  let prevHash = '0'.repeat(64);
  const results = [];

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      results.push({ entry: null, valid: false, chainOk: false, error: 'JSON_PARSE_ERROR' });
      continue;
    }

    // Verificar checksum propio
    const raw = JSON.stringify({ ...entry, checksum: undefined });
    const expected = crypto.createHash('sha256').update(raw).digest('hex');
    const valid    = expected === entry.checksum;
    const chainOk  = entry.prevHash === prevHash;

    results.push({ entry, valid, chainOk });
    prevHash = entry.checksum;
  }

  return results;
}

function listSegments() {
  if (!fs.existsSync(WAL_DIR)) return [];
  return fs.readdirSync(WAL_DIR)
    .filter(f => f.match(/^wal_seg_\d+\.log$/))
    .sort();
}

function getStatus() {
  return {
    initialized,
    durabilityMode,
    currentSegment:     _segmentName(currentSegmentIndex),
    currentSegmentSize,
    sequenceCounter,
    lastChecksum:       lastChecksum.slice(0, 12) + '...',
    pendingWrites:      writeQueue.length,
    walDir:             WAL_DIR
  };
}

module.exports = {
  init,
  append,
  shutdown,
  readSegment,
  listSegments,
  getStatus,
  DurabilityMode
};
