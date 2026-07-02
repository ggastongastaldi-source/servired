// socPipeline.js — Orquestador del pipeline SOC completo.
// Encadena las 4 capas en orden: Police (dixieScan) -> Fiscal (runCorrelation) -> Defensor (runDefensor).
// Punto unico de entrada para boot + cron. Si se agrega Capa 5 (Jurisprudencia),
// solo se toca este archivo, no server.js.
//
// Politica de fallos: RESILIENTE, no fail-fast. Cada etapa trabaja sobre estado
// YA PERSISTIDO en Mongo, no sobre el resultado en memoria de la etapa anterior.
// Cada etapa se ejecuta siempre, y cada error se registra por separado sin frenar la cadena.
//
// Lock en memoria: evita corridas solapadas si una ejecucion tarda mas que el
// intervalo del cron (30 min). Suficiente para una sola instancia (Render free
// tier = 1 dyno) — si en el futuro hay multiples instancias, esto debe migrar
// a un lock distribuido (ej. Mongo con TTL).

'use strict';

const crypto = require('crypto');
const { scan: dixieScan } = require('./dixieScanner');
const { runCorrelation } = require('./incidentCaseAggregator');
const { runDefensor } = require('./defensor');

let _running = false;

async function runSocPipeline() {
  if (_running) {
    console.warn(JSON.stringify({
      level: 'warn', source: 'SOC_PIPELINE',
      message: 'corrida anterior aun en curso — se omite esta ejecucion para evitar solapamiento',
      timestamp: new Date().toISOString()
    }));
    return { skipped: true, reason: 'PIPELINE_ALREADY_RUNNING' };
  }

  _running = true;
  const pipelineRunId = crypto.randomUUID();
  const startedAt = new Date();
  const result = { pipelineRunId, startedAt, scan: null, correlation: null, defensor: null, errors: [], timings: {} };

  try {
    let t0 = Date.now();
    try {
      result.scan = await dixieScan({ pipelineRunId });
    } catch (e) {
      console.error('[SOC_PIPELINE]', pipelineRunId, 'Police (dixieScan) error:', e.message);
      result.errors.push('SCAN_FAILED: ' + e.message);
    }
    result.timings.scanMs = Date.now() - t0;

    t0 = Date.now();
    try {
      result.correlation = await runCorrelation({ pipelineRunId });
    } catch (e) {
      console.error('[SOC_PIPELINE]', pipelineRunId, 'Fiscal (runCorrelation) error:', e.message);
      result.errors.push('CORRELATION_FAILED: ' + e.message);
    }
    result.timings.correlationMs = Date.now() - t0;

    t0 = Date.now();
    try {
      result.defensor = await runDefensor({ pipelineRunId });
    } catch (e) {
      console.error('[SOC_PIPELINE]', pipelineRunId, 'Defensor (runDefensor) error:', e.message);
      result.errors.push('DEFENSOR_FAILED: ' + e.message);
    }
    result.timings.defensorMs = Date.now() - t0;

    // Estado resumido: SUCCESS si nada fallo, FAILED si las 3 etapas fallaron, PARTIAL_SUCCESS en el resto.
    const status = result.errors.length === 0 ? 'SUCCESS'
      : result.errors.length >= 3 ? 'FAILED'
      : 'PARTIAL_SUCCESS';
    result.status = status;

    console.log(JSON.stringify({
      level: status === 'SUCCESS' ? 'info' : 'warn', source: 'SOC_PIPELINE',
      pipelineRunId, status,
      durationMs: Date.now() - startedAt.getTime(),
      timings: result.timings,
      newFindings: result.scan && result.scan.newFindings,
      casesCreated: result.correlation && (result.correlation.casesCreated || 0),
      casesResolved: result.defensor && result.defensor.resolved,
      errors: result.errors,
      timestamp: new Date().toISOString()
    }));

    return result;
  } finally {
    _running = false;
  }
}

module.exports = { runSocPipeline };
