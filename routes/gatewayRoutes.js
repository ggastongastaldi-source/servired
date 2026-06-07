/**
 * B19 Control Plane Gateway — API Routes
 * Montado en: /api/b19/gateway
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { soloAdmin } = require('../middleware/auth');
const gateway = require('../services/controlPlaneGateway');
const policyEngine = require('../services/policyEngine');

// GET /api/b19/gateway/metrics — estado del sistema para dashboard
router.get('/metrics', soloAdmin, (req, res) => {
  res.json({ ok: true, metrics: gateway.getMetrics() });
});

// GET /api/b19/gateway/health — HEAD-only para ping (O(1))
router.head('/health', (req, res) => res.sendStatus(200));
router.get ('/health', (req, res) => {
  const m = gateway.getMetrics();
  res.json({
    ok:       true,
    frozen:   m.frozen,
    shadow:   m.shadowOnly,
    uptime:   process.uptime(),
    decisions: m.totalDecisions,
  });
});

// POST /api/b19/gateway/process — procesar evento económico
router.post('/process', soloAdmin, async (req, res) => {
  try {
    const out = await gateway.process(req.body);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/gateway/freeze — freeze global de emergencia
router.post('/freeze', soloAdmin, (req, res) => {
  gateway.freeze();
  res.json({ ok: true, frozen: true });
});

// POST /api/b19/gateway/unfreeze
router.post('/unfreeze', soloAdmin, (req, res) => {
  gateway.unfreeze();
  res.json({ ok: true, frozen: false });
});

// POST /api/b19/gateway/shadow — activar/desactivar shadow mode
router.post('/shadow', soloAdmin, (req, res) => {
  const { enabled } = req.body;
  gateway.setShadow(enabled);
  res.json({ ok: true, shadowOnly: !!enabled });
});

// POST /api/b19/gateway/rollback/:ruleId — rollback determinista
router.post('/rollback/:ruleId', soloAdmin, async (req, res) => {
  try {
    const result = await gateway.rollback(req.params.ruleId);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/gateway/seed — seed de reglas (solo dev/staging)
router.post('/seed', soloAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.body.force) {
    return res.status(403).json({ ok: false, error: 'Seed bloqueado en producción. Enviar force:true para forzar.' });
  }
  try {
    const { createRule } = policyEngine;
    // Re-exportar función del engine si es necesario
    res.json({ ok: true, msg: 'Correr node seeds/seedPolicies.js directamente en Termux' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
