const express  = require('express');
const router   = express.Router();
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { runForensicAudit } = require('../services/financeEngine');
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
      SERVIRED_REVENUE: 0,
    };
    for (const row of agg) balances[row._id] = row.balance;
    res.json({ ok: true, balances });
  } catch(e) {
    console.error('[adminFinance] balances error:', e.message);
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

module.exports = router;
