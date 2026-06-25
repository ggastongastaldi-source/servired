'use strict';
const mongoose = require('mongoose');
require('dotenv').config();
const { parseArgs } = require('./lib/args');
const { buildRng } = require('./lib/rng');
const MetricsCollector = require('./metrics/collector');
const scenarios = {
  flashCrash:       require('./scenarios/flashCrash'),
  spamBurst:        require('./scenarios/spamBurst'),
  slowManipulation: require('./scenarios/slowManipulation'),
};
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { scenario, mode, seed, dryRun } = args;
  if (!scenarios[scenario]) { console.error(`[ChaosLab] Escenario desconocido: "${scenario}"`); process.exit(1); }
  const runId = `run_${Date.now()}_${seed ?? 'stochastic'}`;
  console.log(`[ChaosLab] Escenario: ${scenario} | Modo: ${mode} | Seed: ${seed ?? 'N/A'} | RunId: ${runId}`);
  if (dryRun) { console.log('[ChaosLab] DRY-RUN OK.'); return; }
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('[ChaosLab] MongoDB conectado.');
  const rng = buildRng(seed);
  const metrics = new MetricsCollector(runId, scenario);
  try {
    await scenarios[scenario].run({ rng, metrics, runId, seed });
    // Esperar 2 ciclos de micro-batch para que el observer procese
    console.log('[ChaosLab] Esperando flush del observer...');
    await new Promise(r => setTimeout(r, 5000));
  } catch (err) {
    console.error('[ChaosLab] ERROR:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('[ChaosLab] MongoDB desconectado.');
  }
  console.log('\n[ChaosLab] ===== REPORTE =====');
  console.log(JSON.stringify(metrics.report(), null, 2));
}
main();
