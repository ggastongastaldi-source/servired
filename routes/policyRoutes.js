/**
 * B19 Policy Engine — API Routes
 * Montado en: /api/b19/policy
 */
const express = require('express');
const router  = express.Router();
const { soloAdmin } = require('../middleware/auth');
const pe = require('../services/policyEngine');

// GET /api/b19/policy — listar reglas (con filtros opcionales)
router.get('/', soloAdmin, async (req, res) => {
  try {
    const { status, ruleId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (ruleId) filter.ruleId = ruleId;
    const rules = await pe.getRules(filter);
    res.json({ ok: true, count: rules.length, rules });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/policy — crear nueva regla/versión
router.post('/', soloAdmin, async (req, res) => {
  try {
    const rule = await pe.createRule({ ...req.body, createdBy: req.user?.id || 'admin' });
    res.status(201).json({ ok: true, rule });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/policy/:ruleId/activate — shadow → active
router.post('/:ruleId/activate', soloAdmin, async (req, res) => {
  try {
    const { version } = req.body;
    const rule = await pe.activateRule(req.params.ruleId, version, req.user?.id || 'admin');
    res.json({ ok: true, rule });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/policy/:ruleId/rollback — rollback determinista
router.post('/:ruleId/rollback', soloAdmin, async (req, res) => {
  try {
    const result = await pe.rollbackRule(req.params.ruleId);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/policy/:ruleId/freeze
router.post('/:ruleId/freeze', soloAdmin, async (req, res) => {
  try {
    await pe.freezeRule(req.params.ruleId);
    res.json({ ok: true, frozen: req.params.ruleId });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/policy/evaluate — test de evaluación contra contexto (solo admin)
router.post('/evaluate', soloAdmin, async (req, res) => {
  try {
    const result = await pe.evaluateContext(req.body);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
