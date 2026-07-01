// incidentCaseAggregator.js — Capa 3: Correlación (Fiscal)
// Lee PolicyFinding (evidencia, producida por Police/dixieScanner) y
// externalHealthMonitor (Capa 1) y agrupa en IncidentCase.
// NUNCA escanea, NUNCA ejecuta acciones — solo correlaciona y diagnostica.

const { PolicyFinding } = require('./PolicyFinding');
const { IncidentCase } = require('./IncidentCase');
const { getSnapshot: getExternalHealthSnapshot } = require('../../../services/externalHealthMonitor');
const crypto = require('crypto');

// Ventana canónica reutilizada de circuitBreaker.js — NO duplicar el valor,
// importar la constante para que ambos módulos queden sincronizados siempre.
const { ACCUMULATION_WINDOW_MS: CORRELATION_WINDOW_MS } = require('./circuitBreaker');

// caseId determinístico: mismo rule + misma ventana de DETECCIÓN → mismo caso.
// Ancla a la ventana en que el finding fue detectado, no al momento en que
// corre el agregador — evita que findings viejos se re-agrupen cada corrida.
function _deriveCaseId(rule, windowStart) {
  return crypto.createHash('sha256').update(`${rule}:${windowStart}`).digest('hex').slice(0, 24);
}

function _windowStartFor(detectedAtMs) {
  return Math.floor(detectedAtMs / CORRELATION_WINDOW_MS) * CORRELATION_WINDOW_MS;
}

function _severityRank(s) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[s] || 0;
}

// Confianza como función independiente — encapsulada para que el motor de
// políticas pueda reemplazarla o hacerla configurable sin tocar el resto.
function _computeConfidence(findingsCount) {
  return Math.min(0.4 + (findingsCount * 0.15), 0.95); // cap 0.95: nunca certeza absoluta
}

function _buildProbableCause(rule, findings) {
  const count = findings.length;
  const collection = findings[0]?.collection || 'desconocida';
  return `${count} finding(s) de tipo ${rule} detectados en ${collection} dentro de una ventana de ${CORRELATION_WINDOW_MS / 60000} min`;
}

// ── Correlación de PolicyFinding abiertos, agrupados por rule + ventana de DETECCIÓN ──
async function correlateOpenFindings() {
  const openFindings = await PolicyFinding.find({ status: 'OPEN' }).lean();
  if (!openFindings.length) return { casesCreated: 0, casesUpdated: 0 };

  // Agrupar por (rule, ventana de detección) — no por rule solo, y no por "ahora"
  const groups = {};
  for (const f of openFindings) {
    const detectedAtMs = new Date(f.detectedAt).getTime();
    const windowStart = _windowStartFor(detectedAtMs);
    const key = `${f.rule}::${windowStart}`;
    if (!groups[key]) groups[key] = { rule: f.rule, windowStart, findings: [] };
    groups[key].findings.push(f);
  }

  let casesCreated = 0, casesUpdated = 0;

  for (const { rule, windowStart, findings } of Object.values(groups)) {
    const caseId = _deriveCaseId(rule, windowStart);
    const maxSeverity = findings.reduce((max, f) =>
      _severityRank(f.severity) > _severityRank(max) ? f.severity : max, 'LOW');
    const confidence = _computeConfidence(findings.length);
    const findingIds = findings.map(f => f.findingId);

    // Idempotencia fuerte: findOneAndUpdate + upsert en una sola operación
    // atómica — evita condición de carrera entre corridas concurrentes.
    const result = await IncidentCase.findOneAndUpdate(
      { caseId, status: { $in: ['OPEN', 'INVESTIGATING'] } }, // nunca reabrir RESOLVED/FALSE_POSITIVE
      {
        $setOnInsert: {
          caseId,
          severity: maxSeverity,
          probableCause: _buildProbableCause(rule, findings),
          affectedService: findings[0]?.collection || null,
          priority: maxSeverity === 'CRITICAL' ? 'P1' : maxSeverity === 'HIGH' ? 'P2' : maxSeverity === 'MEDIUM' ? 'P3' : 'P4',
          status: 'OPEN',
          detectedAt: new Date(Math.min(...findings.map(f => new Date(f.detectedAt).getTime()))),
          timeline: [{ action: 'CREATED', detail: { rule, findingCount: findings.length } }],
        },
        $addToSet: { findingIds: { $each: findingIds } },
        $set: { severity: maxSeverity, confidence, updatedAt: new Date(), impact: `${findings.length} finding(s) abiertos sin resolver` },
      },
      { upsert: true, includeResultMetadata: true } // metadata explícita — nunca inferir insert/update por null
    );

    // lastErrorObject.updatedExisting === false es la señal inequívoca de insert (MongoDB, no heurística)
    const wasInsert = result?.lastErrorObject?.updatedExisting === false;
    if (wasInsert) casesCreated++; else casesUpdated++;
  }

  return { casesCreated, casesUpdated };
}

// ── Correlación de integraciones externas degradadas (Capa 1 → Capa 3) ──
async function correlateExternalHealth() {
  const snapshot = getExternalHealthSnapshot();
  let casesCreated = 0;

  for (const [service, data] of Object.entries(snapshot)) {
    if (data.status !== 'DOWN' && data.status !== 'DEGRADED') continue;

    const detectedAtMs = data.lastChecked ? new Date(data.lastChecked).getTime() : Date.now();
    const windowStart = _windowStartFor(detectedAtMs);
    const caseId = _deriveCaseId(`EXTERNAL_${service}`, windowStart);

    const result = await IncidentCase.findOneAndUpdate(
      { caseId },
      {
        $setOnInsert: {
          caseId,
          findingIds: [],
          severity: data.status === 'DOWN' ? 'HIGH' : 'MEDIUM',
          confidence: 0.9,
          probableCause: `Integración externa "${service}" reporta ${data.status}: ${data.error || 'sin detalle'}`,
          affectedService: service,
          impact: `Latencia: ${data.latencyMs}ms — última verificación: ${data.lastChecked}`,
          priority: data.status === 'DOWN' ? 'P2' : 'P3',
          status: 'OPEN',
          detectedAt: new Date(detectedAtMs),
          timeline: [{ action: 'CREATED', detail: { service, status: data.status, error: data.error } }],
        }
      },
      { upsert: true, includeResultMetadata: true }
    );

    const wasInsert = result?.lastErrorObject?.updatedExisting === false;
    if (wasInsert) casesCreated++;
  }

  return { casesCreated };
}

async function runCorrelation() {
  const findingsResult = await correlateOpenFindings();
  const externalResult = await correlateExternalHealth();
  const total = findingsResult.casesCreated + externalResult.casesCreated;
  if (total > 0 || findingsResult.casesUpdated > 0) {
    console.log(JSON.stringify({
      level: 'info', source: 'FISCAL',
      casesCreated: total, casesUpdated: findingsResult.casesUpdated,
      timestamp: new Date().toISOString()
    }));
  }
  return { ...findingsResult, ...externalResult };
}

module.exports = { runCorrelation, correlateOpenFindings, correlateExternalHealth, _computeConfidence };
