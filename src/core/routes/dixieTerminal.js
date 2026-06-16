// dixieTerminal.js — rutas de Dixie Gate Terminal
// GET  /api/sinapsis/dixie/findings      — lista findings con filtros
// GET  /api/sinapsis/dixie/report        — resumen ejecutivo + estado operativo
// POST /api/sinapsis/dixie/scan          — trigger manual de scan
// POST /api/sinapsis/dixie/degraded/on   — activa modo degradado (Sprint 3C-A, manual)
// POST /api/sinapsis/dixie/degraded/off  — desactiva modo degradado

const express = require('express');
const router  = express.Router();
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { scan }           = require('../../sinapsis/dixieTerminal/dixieScanner');
const { PolicyFinding }  = require('../../sinapsis/dixieTerminal/PolicyFinding');
const { SystemState, getState } = require('../../sinapsis/dixieTerminal/SystemState');

// POST /scan — trigger manual
router.post('/scan', verificarToken, soloAdmin, async (req, res) => {
  try {
    const result = await scan();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /findings — lista paginada con filtros opcionales
// Query params: status (OPEN|ACKNOWLEDGED), rule, limit (default 50)
router.get('/findings', verificarToken, soloAdmin, async (req, res) => {
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

// POST /degraded/on — activa modo degradado manualmente (observacional, Sprint 3C-A)
router.post('/degraded/on', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const updated = await SystemState.findByIdAndUpdate(
      'global',
      { mode: 'DEGRADED', reason: reason || 'Activado manualmente sin motivo especificado' },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(JSON.stringify({
      level: 'warn', source: 'SYSTEM_STATE',
      action: 'SET_DEGRADED_MODE', actor: req.user?.nombre || req.user?.userId,
      reason: updated.reason, timestamp: new Date().toISOString()
    }));
    res.json({ ok: true, mode: updated.mode, reason: updated.reason });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /degraded/off — vuelve a modo normal
router.post('/degraded/off', verificarToken, soloAdmin, async (req, res) => {
  try {
    const updated = await SystemState.findByIdAndUpdate(
      'global',
      { mode: 'NORMAL', reason: null },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(JSON.stringify({
      level: 'info', source: 'SYSTEM_STATE',
      action: 'CLEAR_DEGRADED_MODE', actor: req.user?.nombre || req.user?.userId,
      timestamp: new Date().toISOString()
    }));
    res.json({ ok: true, mode: updated.mode, reason: updated.reason });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /report — resumen ejecutivo con agregaciones + estado operativo
router.get('/report', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [open, total, bySeverity, byRule, latest, state] = await Promise.all([
      PolicyFinding.countDocuments({ status: 'OPEN' }),
      PolicyFinding.countDocuments(),
      PolicyFinding.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      PolicyFinding.aggregate([
        { $group: { _id: '$rule', open: { $sum: { $cond: [{ $eq: ['$status','OPEN'] }, 1, 0] } }, total: { $sum: 1 } } }
      ]),
      PolicyFinding.findOne({ status: 'OPEN' }).sort({ detectedAt: -1 }).lean(),
      getState()
    ]);

    res.json({
      ok:          true,
      generatedAt: new Date().toISOString(),
      health:      open === 0 ? 'CLEAN' : open < 3 ? 'DEGRADED' : 'ALERT',
      mode:        state.mode,
      modeReason:  state.reason,
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
