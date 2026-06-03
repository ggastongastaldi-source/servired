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

module.exports = router;
