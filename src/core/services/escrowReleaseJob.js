const { releaseWorkerFunds } = require('./financeEngine');
const FinancialTransaction   = require('../models/FinancialTransaction');
const Pedido                 = require('../models/Pedido');

const HOLD_HOURS = 72;
const JOB_INTERVAL_MS = 15 * 60 * 1000; // cada 15 minutos

async function runEscrowRelease() {
  const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000);
  console.log(`[escrowJob] 🔍 Buscando pedidos HELD anteriores a ${cutoff.toISOString()}`);

  const pedidos = await Pedido.find({
    payment_status: 'HELD',
    updatedAt: { $lt: cutoff },
  }).lean();

  if (pedidos.length === 0) {
    console.log('[escrowJob] ✅ Sin pedidos HELD vencidos');
    return;
  }

  console.log(`[escrowJob] 📋 ${pedidos.length} pedido(s) para liberar`);

  for (const pedido of pedidos) {
    try {
      const ft = await FinancialTransaction.findOne({
        order_id: String(pedido._id),
        status:   'CAPTURED',
      });

      if (!ft) {
        console.warn(`[escrowJob] ⚠️ Sin FT CAPTURED para order ${pedido._id} — omitiendo`);
        continue;
      }

      await releaseWorkerFunds({ transaction_id: ft.transaction_id });

      await Pedido.findByIdAndUpdate(pedido._id, {
        payment_status: 'RELEASED',
        estado:         'CERRADA',
        liberadoAt:     new Date(),
      });

      console.log(`[escrowJob] ✅ Liberado — order: ${pedido._id} | txn: ${ft.transaction_id}`);
    } catch(err) {
      console.error(`[escrowJob] ❌ Error liberando order ${pedido._id}:`, err.message);
    }
  }
}

function startEscrowReleaseJob() {
  console.log(`[escrowJob] 🚀 Iniciado — revisión cada ${JOB_INTERVAL_MS / 60000} minutos`);
  runEscrowRelease().catch(e => console.error('[escrowJob] Error inicial:', e.message));
  return setInterval(() => {
    runEscrowRelease().catch(e => console.error('[escrowJob] Error periódico:', e.message));
  }, JOB_INTERVAL_MS);
}

module.exports = { startEscrowReleaseJob, runEscrowRelease };
