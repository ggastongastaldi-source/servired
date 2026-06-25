/**
 * Recovery Runner — ServiRed OS RTMIL v1
 * Uso: node scripts/replay.js
 * Demuestra que ServiRed puede reconstruirse completamente desde WAL
 */

require('dotenv').config();

const replayEngine      = require('../services/replayEngine');
const { createProjections, applyEvent, summarize } = require('../services/projectionBuilder');
const wal               = require('../services/walWriter');

async function run() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  ServiRed OS — Replay Engine v1');
  console.log('  Reconstrucción desde WAL');
  console.log('═══════════════════════════════════════════\n');

  wal.init();

  const projections = createProjections();
  const corruptLog  = [];

  const stats = await replayEngine.replay({
    onEvent: async (entry) => {
      applyEvent(projections, entry);
    },
    onCorrupt: (info) => {
      corruptLog.push(info);
      console.warn(`[CORRUPT] seg=${info.segmentFile} seq=${info.entry?.seq} reason=${info.error}`);
    }
  });

  const summary = summarize(projections);

  console.log('── Resultado del Replay ──────────────────');
  console.log(`Segmentos leídos : ${stats.segmentsRead}`);
  console.log(`Eventos válidos  : ${stats.valid}`);
  console.log(`Eventos corruptos: ${stats.corrupt}`);
  console.log(`Eventos saltados : ${stats.skipped}`);
  console.log('');
  console.log('── Proyecciones reconstruidas ────────────');
  console.log(`Usuarios         : ${summary.users}`);
  console.log(`Comercios        : ${summary.commerce}`);
  console.log(`Servicios        : ${summary.services}`);
  console.log(`Pagos            : ${summary.payments}`);
  console.log(`Boosts           : ${summary.boosts}`);
  console.log(`Revenue total    : ARS $${summary.totalRevenueARS.toLocaleString('es-AR')}`);

  if (corruptLog.length > 0) {
    console.log('\n── Entradas corruptas ────────────────────');
    corruptLog.forEach(c => console.log(` · ${c.segmentFile} seq=${c.entry?.seq} → ${c.error}`));
  }

  console.log('\n═══════════════════════════════════════════');
  const integridad = stats.corrupt === 0 ? '✅ ÍNTEGRO' : '⚠️  CORRUPCIÓN DETECTADA';
  console.log(`  Estado WAL: ${integridad}`);
  console.log('═══════════════════════════════════════════\n');

  wal.shutdown();
  process.exit(stats.corrupt > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('[REPLAY] Error fatal:', err);
  process.exit(2);
});
