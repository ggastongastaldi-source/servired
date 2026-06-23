'use strict';
const express = require('express');
const router = express.Router();
const { trackEvent } = require('../src/core/services/trackEvent');

const ALLOWED = new Set([
  'commerce_feed_view', 'commerce_feed_click',
  'assistant_boost_chip_click', 'assistant_session_started',
  'commerce_register_started', 'boost_viewed'
]);

// POST /api/track — pixel de tracking frontend (fire-and-forget)
router.post('/', async (req, res) => {
  res.sendStatus(200); // responder inmediato, no bloquear UI
  const { event, meta = {} } = req.body || {};
  if (!event || !ALLOWED.has(event)) return;
  trackEvent(event, { meta });
});

module.exports = router;
