// socPipeline.js — Orquestador del pipeline SOC completo.
// Encadena las 4 capas en orden: Police (dixieScan) -> Fiscal (runCorrelation) -> Defensor (runDefensor).
// Punto unico de entrada para boot + cron. Si se agrega Capa 5 (Jurisprudencia),
// solo se toca este archivo, no server.js.
//
// Politica de fallos: RESILIENTE, no fail-fast. Cada etapa trabaja sobre estado
// YA PERSISTIDO en Mongo, no sobre el resultado en memoria de la etapa anterior.
// Si el scan falla, el Fiscal igual puede correlacionar PolicyFinding viejos sin
// procesar; si la correlacion falla, el Defensor igual puede reintentar casos
// abiertos de corridas previas. Cada etapa se ejecuta siempre, y cada error se
// registra por separado sin frenar la cadena.

'use strict';

const { scan: dixieScan } = require('./dixieScanner');
const { runCorrelation } = require('./incidentCaseAggregator');
const { runDefensor } = require('./defensor');

async function runSocPipeline() {
  const startedAt = new Date();
  const result = { startedAt, scan: null, correlation: null, defensor: null, errors: [] };

  try {
    result.scan = await dixieScan();
  } catch (e) {
    console.error('[SOC_PIPELINE] Police (dixieScan) error:', e.message);
    result.errors.push('SCAN_FAILED: ' + e.message);
  }

  try {
    result.correlation = await runCorrelation();
  } catch (e) {
    console.error('[SOC_PIPELINE] Fiscal (runCorrelation) error:', e.message);
    result.errors.push('CORRELATION_FAILED: ' + e.message);
  }

  try {
    result.defensor = await runDefensor();
  } catch (e) {
    console.error('[SOC_PIPELINE] Defensor (runDefensor) error:', e.message);
    result.errors.push('DEFENSOR_FAILED: ' + e.message);
  }

  console.log(JSON.stringify({
    level: result.errors.length ? 'warn' : 'info', source: 'SOC_PIPELINE',
    durationMs: Date.now() - startedAt.getTime(),
    newFindings: result.scan && result.scan.newFindings,
    casesCreated: result.correlation && (result.correlation.casesCreated || 0),
    casesResolved: result.defensor && result.defensor.resolved,
    errors: result.errors,
    timestamp: new Date().toISOString()
  }));

  return result;
}

module.exports = { runSocPipeline };
