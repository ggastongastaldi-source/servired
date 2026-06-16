// dixieTerminal.js — rutas de Dixie Gate Terminal
// GET  /api/sinapsis/dixie/findings — lista findings con filtros
// GET  /api/sinapsis/dixie/report   — resumen ejecutivo
// POST /api/sinapsis/dixie/scan     — trigger manual de scan

const express = require('express');
const router  = express.Router();
const { soloAdmin }    = require('../middleware/auth');
const { scan }         = require('../../sinapsis/dixieTerminal/dixieScanner');
const { PolicyFinding } = require('../../sinapsis/dixieTerminal/PolicyFinding');

// POST /scan — trigger manual
router.post('/scan', soloAdmin, async (req, res) => {
  try {
    const result = await scan();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /findings — lista paginada con filtros opcionales
// Query params: status (OPEN|ACKNOWLEDGED), rule, limit (default 50)
router.get('/findings', soloAdmin, async (req, res) => {
  try {
    const { status, rule, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (rule)   filter.rule   = rule;

    const findings = await PolicyFinding
      .find(filter)
      .sort({ detectedAt: -1 })
      .limit(Math.min(Number(limit), 200))
      .lean();

    res.json({ ok: true, total: findings.length, findings });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /report — resumen ejecutivo con agregaciones
router.get('/report', soloAdmin, async (req, res) => {
  try {
    const [open, total, bySeverity, byRule, latest] = await Promise.all([
      PolicyFinding.countDocuments({ status: 'OPEN' }),
      PolicyFinding.countDocuments(),
      PolicyFinding.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      PolicyFinding.aggregate([
        { $group: { _id: '$rule', open: { $sum: { $cond: [{ $eq: ['$status','OPEN'] }, 1, 0] } }, total: { $sum: 1 } } }
      ]),
      PolicyFinding.findOne({ status: 'OPEN' }).sort({ detectedAt: -1 }).lean()
    ]);

    res.json({
      ok:          true,
      generatedAt: new Date().toISOString(),
      health:      open === 0 ? 'CLEAN' : open < 3 ? 'DEGRADED' : 'ALERT',
      summary: {
        open,
        total,
        acknowledged: total - open
      },
      bySeverity: Object.fromEntries(bySeverity.map(x => [x._id, x.count])),
      byRule:     Object.fromEntries(byRule.map(x => [x._id, { open: x.open, total: x.total }])),
      latestOpen: latest ? {
        findingId:  latest.findingId,
        rule:       latest.rule,
        severity:   latest.severity,
        detectedAt: latest.detectedAt
      } : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
