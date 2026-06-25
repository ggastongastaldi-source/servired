/**
 * Replay Engine v1 — ServiRed OS RTMIL v1
 * Lee WAL, valida checksums, valida hash-chain, ordena por seq
 * G1: verifica integridad de cada entry
 * G2: garantiza orden determinístico
 * G4: reporta corrupción con evidencia
 */

const wal = require('./walWriter');

/**
 * replay(opts) — lee todos los segmentos WAL y emite eventos validados
 * @param {object} opts
 * @param {function} opts.onEvent(entry) — callback por cada evento válido
 * @param {function} opts.onCorrupt(info) — callback por cada entry corrupta
 * @param {number}   opts.fromSeq — opcional, ignorar entries con seq menor
 * @returns {Promise<{segmentsRead, valid, corrupt, skipped}>}
 */
async function replay(opts = {}) {
  const { onEvent, onCorrupt, fromSeq = 0 } = opts;

  const segments = wal.listSegments();
  let valid   = 0;
  let corrupt = 0;
  let skipped = 0;
  let globalPrevHash = '0'.repeat(64);

  for (const segmentFile of segments) {
    const idx = _idxFromFile(segmentFile);
    const entries = wal.readSegment(idx);

    for (const { entry, valid: entryValid, chainOk, error } of entries) {
      if (!entryValid || !chainOk) {
        corrupt++;
        if (onCorrupt) onCorrupt({
          segmentFile,
          entry,
          entryValid,
          chainOk,
          error: error || (!entryValid ? 'CHECKSUM_MISMATCH' : 'CHAIN_BREAK')
        });
        // Resincronizar prevHash para no propagar error en cadena
        if (entry?.checksum) globalPrevHash = entry.checksum;
        continue;
      }

      globalPrevHash = entry.checksum;

      if (entry.seq <= fromSeq) {
        skipped++;
        continue;
      }

      valid++;
      if (onEvent) await onEvent(entry);
    }
  }

  return { segmentsRead: segments.length, valid, corrupt, skipped };
}

function _idxFromFile(filename) {
  const m = filename.match(/wal_seg_(\d+)\.log/);
  return m ? parseInt(m[1], 10) : 0;
}

module.exports = { replay };
