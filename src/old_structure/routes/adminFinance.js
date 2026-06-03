const express  = require('express');
const router   = express.Router();
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { runForensicAudit, getGlobalBalances } = require('../services/financeEngine');
const FinancialIncident     = require('../models/FinancialIncident');
const FinanceWatchdogStatus = require('../models/FinanceWatchdogStatus');
const { Ledger } = require('../services/ledgerService');

// GET /api/admin/finance/audit
router.get('/audit', verificarToken, soloAdmin, async (req, res) => {
  try {
    const issues = await runForensicAudit();
    res.json({ ok: true, issues, total: issues.length });
  } catch(e) {
    console.error('[adminFinance] audit error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// GET /api/admin/finance/balances
router.get('/balances', verificarToken, soloAdmin, async (req, res) => {
  try {
    const agg = await Ledger.aggregate([
      { $group: { _id: '$account', balance: { $sum: '$delta' } } }
    ]);
    const balances = {
      ESCROW_PLATFORM:  0,
        WORKER_PENDING:   0,
        WORKER_AVAILABLE: 0,
      SERVIRED_REVENUE: 0,
    };
    for (const row of agg) balances[row._id] = row.balance;
    res.json({ ok: true, balances });
  } catch(e) {
    console.error('[adminFinance] balances error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// POST /api/admin/finance/release/:orderId — liberación manual
router.post('/release/:orderId', verificarToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const Pedido = require('../models/Pedido');
    const FinancialTransaction = require('../models/FinancialTransaction');
    const { releaseWorkerFunds } = require('../services/financeEngine');

    const pedido = await Pedido.findById(orderId);
    if (!pedido) return res.json({ ok: false, error: 'Pedido no encontrado' });
    if (pedido.payment_status !== 'HELD')
      return res.json({ ok: false, error: `payment_status actual: ${pedido.payment_status} — solo HELD puede liberarse` });

    const ft = await FinancialTransaction.findOne({ order_id: orderId, status: 'CAPTURED' });
    if (!ft) return res.json({ ok: false, error: 'FinancialTransaction CAPTURED no encontrada' });

    await releaseWorkerFunds({ transaction_id: ft.transaction_id });
    await Pedido.findByIdAndUpdate(orderId, {
      payment_status: 'RELEASED',
      estado:         'CERRADA',
      liberadoAt:     new Date(),
    });

    console.log(`[adminFinance] ✅ Liberación manual — order: ${orderId}`);
    res.json({ ok: true, transaction_id: ft.transaction_id, orderId });
  } catch(e) {
    console.error('[adminFinance] release error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// GET /api/admin/finance/order/:orderId
router.get('/order/:orderId', verificarToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const Pedido = require('../models/Pedido');
    const FinancialTransaction = require('../models/FinancialTransaction');
    const { Ledger } = require('../services/ledgerService');

    const [pedido, financialTransaction, ledgerEntries] = await Promise.all([
      Pedido.findById(orderId).lean(),
      FinancialTransaction.findOne({ order_id: orderId }).lean(),
      Ledger.find({ order_id: orderId }).sort({ created_at: 1 }).lean(),
    ]);

    if (!pedido) return res.json({ ok: false, error: 'Pedido no encontrado' });

    res.json({
      ok: true,
      pedido,
      financialTransaction: financialTransaction || null,
      ledger: ledgerEntries,
    });
  } catch(e) {
    console.error('[adminFinance] order detail error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});


// GET /api/admin/finance/dashboard
router.get('/dashboard', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [watchdog, openIncidents, balances] = await Promise.all([
      FinanceWatchdogStatus.findOne({ service: 'FinanceWatchdog' }).lean(),
      FinancialIncident.find({ status: 'OPEN' }).lean(),
      getGlobalBalances(),
    ]);

    // Conteos de incidentes
    const open_count     = openIncidents.length;
    const critical_count = openIncidents.filter(i => i.severity === 'CRITICAL').length;
    const warning_count  = openIncidents.filter(i => i.severity === 'WARNING').length;

    // Ultimos 5 incidentes OPEN ordenados por last_detected_at desc
    const recent = await FinancialIncident.find({ status: 'OPEN' })
      .select('incident_id transaction_id issue severity status last_detected_at occurrences')
      .sort({ last_detected_at: -1 })
      .limit(5)
      .lean();

    res.json({
      ok: true,
      watchdog: watchdog ? {
        status:           watchdog.status,
        last_run_at:      watchdog.last_run_at,
        last_success_at:  watchdog.last_success_at,
        last_issue_count: watchdog.last_issue_count,
        last_error:       watchdog.last_error,
      } : null,
      incidents: {
        open_count,
        critical_count,
        warning_count,
        recent,
      },
      balances: {
        ESCROW_PLATFORM:  balances.ESCROW_PLATFORM,
        WORKER_PENDING:   balances.WORKER_PENDING,
        WORKER_AVAILABLE: balances.WORKER_AVAILABLE,
        PLATFORM_REVENUE: balances.PLATFORM_REVENUE,
      },
    });

  } catch(err) {
    console.error('[adminFinance] dashboard error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
