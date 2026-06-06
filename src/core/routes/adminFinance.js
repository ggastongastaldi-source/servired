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
router.post('/release/:orderId', verificarToken, soloAdmin, async (req, res) => {
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
router.get('/order/:orderId', verificarToken, soloAdmin, async (req, res) => {
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


// GET /api/admin/finance/shadow — metricas de shadow comparison
router.get('/shadow', verificarToken, soloAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const ShadowComparison = mongoose.models.ShadowComparison ||
      mongoose.model('ShadowComparison',
        new mongoose.Schema({
          pedidoId: String, ts: Date,
          gr_workerCount: Number, de_candidates: Number,
          de_topScore: Number, de_topETA: Number,
          match: Boolean, matchRate: Number,
          etaDeltaMinutes: Number, de_expanded: Boolean,
        }, { timestamps: false }),
        'shadow_comparisons'
      );

    const total = await ShadowComparison.countDocuments();
    if (total === 0) {
      return res.json({ ok: true, total: 0, message: 'Sin datos shadow aun' });
    }

    const agg = await ShadowComparison.aggregate([
      { $group: {
        _id:              null,
        total:            { $sum: 1 },
        matchCount:       { $sum: { $cond: ['$match', 1, 0] } },
        avgMatchRate:     { $avg: '$matchRate' },
        avgDeScore:       { $avg: '$de_topScore' },
        avgDeETA:         { $avg: '$de_topETA' },
        avgEtaDelta:      { $avg: '$etaDeltaMinutes' },
        avgGrWorkers:     { $avg: '$gr_workerCount' },
        avgDeCandidates:  { $avg: '$de_candidates' },
        expandedCount:    { $sum: { $cond: ['$de_expanded', 1, 0] } },
      }}
    ]);

    const recent = await ShadowComparison.find({})
      .sort({ ts: -1 }).limit(10)
      .select('pedidoId ts gr_workerCount de_candidates de_topScore match matchRate etaDeltaMinutes')
      .lean();

    const stats = agg[0] || {};
    res.json({
      ok: true,
      total,
      matchRate:       Math.round((stats.avgMatchRate || 0) * 100) + '%',
      avgDeScore:      Math.round((stats.avgDeScore || 0) * 1000) / 1000,
      avgDeETA:        Math.round(stats.avgDeETA || 0) + 'min',
      etaImprovement:  Math.round(stats.avgEtaDelta || 0) + 'min',
      avgGrWorkers:    Math.round(stats.avgGrWorkers || 0),
      avgDeCandidates: Math.round(stats.avgDeCandidates || 0),
      expandedRate:    Math.round(((stats.expandedCount || 0) / total) * 100) + '%',
      recent,
    });
  } catch(err) {
    console.error('[adminFinance] shadow error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
