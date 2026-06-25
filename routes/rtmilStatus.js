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

module.exports = router;
