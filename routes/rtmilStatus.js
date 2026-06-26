const express = require('express');
const router  = express.Router();
const rtmil   = require('../services/rtmilIngest');

router.get('/status', (req, res) => {
  try {
    res.json({ ok: true, ...rtmil.getStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/aladin/run', async (req, res) => {
  try {
    const { ejecutarCicloAladin } = require('../src/core/services/priceWorker');
    await ejecutarCicloAladin();
    const ode = require('../services/ontologyDriftEngine');
    const result = await ode.aggregate();
    res.json({ ok: true, cycle: 'complete', ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/ode', async (req, res) => {
  try {
    const ode = require('../services/ontologyDriftEngine');
    const [proposals, all] = await Promise.all([ode.getProposals(10), ode.getAll(20)]);
    res.json({ ok: true, proposals, all });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/ode/aggregate', async (req, res) => {
  try {
    const ode = require('../services/ontologyDriftEngine');
    const result = await ode.aggregate();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
