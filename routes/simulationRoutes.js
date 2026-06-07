/**
 * B19 Policy Simulation Engine — API Routes
 * Montado en: /api/b19/simulation
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { soloAdmin } = require('../middleware/auth');
const sim = require('../services/policySimulationEngine');

// POST /api/b19/simulation/test — simular evento único con hipótesis
router.post('/test', soloAdmin, async (req, res) => {
  try {
    const { event, hypothesis } = req.body;
    if (!event) return res.status(400).json({ ok: false, error: 'event requerido' });
    const result = await sim.simulate(event, hypothesis || {});
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/simulation/replay — batch histórico con hipótesis
router.post('/replay', soloAdmin, async (req, res) => {
  try {
    const { events, hypothesis } = req.body;
    if (!Array.isArray(events) || events.length === 0)
      return res.status(400).json({ ok: false, error: 'events[] requerido' });
    if (events.length > 500)
      return res.status(400).json({ ok: false, error: 'Máximo 500 eventos por replay' });
    const result = await sim.replayHistory(events, hypothesis || {});
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/b19/simulation/drift — Policy Drift Radar (eventos canónicos)
router.get('/drift', soloAdmin, async (req, res) => {
  try {
    const snapshot = await sim.driftSnapshot({});
    res.json({ ok: true, snapshot });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/b19/simulation/drift — drift con hipótesis custom
router.post('/drift', soloAdmin, async (req, res) => {
  try {
    const snapshot = await sim.driftSnapshot(req.body?.hypothesis || {});
    res.json({ ok: true, snapshot });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
