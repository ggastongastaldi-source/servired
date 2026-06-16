// crashRecovery.js — Sprint 2
// Detecta gaps, cadenas rotas y divergencias entre sinapsis_bus_log
// y sinapsis_log_v2. NO repara — solo reporta.
// Compatible con arquitectura existente, sin infraestructura adicional.

const { busReplay, SinapsisBusLog } = require('../../shared/events/persistenceAdapters/sinapsisBusAdapter');
const { replay: govReplay, getHeadIntegrity } = require('./logManagerV2');

// ── Clasificación de severidad ──────────────────────────────────
// HEALTHY   → ambas cadenas íntegras, sin gaps
// DEGRADED  → gaps detectados (crash entre nextSeq y create)
// CORRUPTED → hashes inválidos (manipulación o bug en hash)
function classify(busResult, govResult) {
  if (busResult.broken?.length > 0 || govResult.invalid > 0) return 'CORRUPTED';
  if (busResult.gapCount > 0 || govResult.gapCount > 0)      return 'DEGRADED';
  return 'HEALTHY';
}

async function runCrashRecovery() {
  const startedAt = new Date().toISOString();

  // ── Bus log (sinapsis_bus_log) ──────────────────────────────
  let busResult;
  try {
    busResult = await busReplay(1);
  } catch (err) {
    busResult = { error: err.message, integrityOk: false };
  }

  // ── Governance log (sinapsis_log_v2) ───────────────────────
  let govResult;
  try {
    govResult = await govReplay(1);
  } catch (err) {
    govResult = { error: err.message, integrityOk: false };
  }

  // ── Head integrity (O(1) — solo el último documento) ───────
  let busHead = null;
  try {
    const doc = await SinapsisBusLog.findOne().sort({ sequence: -1 }).lean();
    if (doc) {
      busHead = {
        sequence:  doc.sequence,
        tip:       doc.entryHash?.slice(0, 12) + '...',
        sealedAt:  doc.sealedAt
      };
    }
  } catch (err) {
    busHead = { error: err.message };
  }

  let govHead = null;
  try {
    govHead = await getHeadIntegrity();
  } catch (err) {
    govHead = { error: err.message };
  }

  // ── Divergencia entre colecciones ──────────────────────────
  // Las dos colecciones registran streams distintos (bus vs governance),
  // por lo tanto los totales divergen por diseño.
  // Lo que sí es anómalo: bus_log vacío cuando gov_log tiene entradas
  // luego de un periodo de actividad (indica que el adapter no está escribiendo).
  const busEmpty = (busResult.total === 0) && (govResult.total > 0);

  const status = busResult.error || govResult.error
    ? 'ERROR'
    : classify(busResult, govResult);

  return {
    ok:        status === 'HEALTHY',
    status,
    startedAt,
    bus_log: {
      collection:  'sinapsis_bus_log',
      total:       busResult.total       ?? null,
      valid:       busResult.valid       ?? null,
      invalid:     busResult.invalid     ?? null,
      gaps:        busResult.gaps        ?? [],
      gapCount:    busResult.gapCount    ?? 0,
      broken:      busResult.broken      ?? [],
      integrityOk: busResult.integrityOk ?? false,
      head:        busHead,
      error:       busResult.error       ?? null
    },
    gov_log: {
      collection:  'sinapsis_log_v2',
      total:       govResult.total       ?? null,
      valid:       govResult.valid       ?? null,
      invalid:     govResult.invalid     ?? null,
      gaps:        govResult.gaps        ?? [],
      gapCount:    govResult.gapCount    ?? 0,
      shi:         govResult.shi         ?? null,
      integrityOk: govResult.integrityOk ?? false,
      head:        govHead,
      error:       govResult.error       ?? null
    },
    alerts: [
      ...(busEmpty                        ? ['bus_log vacío con gov_log activo — adapter posiblemente inactivo'] : []),
      ...(busResult.gapCount > 0          ? [`bus_log: ${busResult.gapCount} gap(s) detectado(s) — posible crash entre nextSeq y create`] : []),
      ...(govResult.gapCount > 0          ? [`gov_log: ${govResult.gapCount} gap(s) detectado(s)`] : []),
      ...(busResult.broken?.length > 0    ? [`bus_log: ${busResult.broken.length} entrada(s) con hash inválido`] : []),
      ...(govResult.invalid > 0           ? [`gov_log: ${govResult.invalid} entrada(s) con hash inválido`] : [])
    ]
  };
}

module.exports = { runCrashRecovery };
