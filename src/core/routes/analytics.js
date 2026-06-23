'use strict';
const express  = require('express');
const router   = express.Router();
const svc      = require('../services/analyticsService');

// Middleware: solo acceso interno (admin token o IP local)
// Para MVP: protegido por query param ?key=ANALYTICS_KEY
function analyticsAuth(req, res, next) {
  const key = req.query.key || req.headers['x-analytics-key'];
  if (!process.env.ANALYTICS_KEY || key === process.env.ANALYTICS_KEY) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// GET /api/analytics/overview
router.get('/overview', analyticsAuth, async (req, res) => {
  try {
    const data = await svc.getOverview();
    res.json({ ok: true, ...data });
  } catch(e) {
    console.error('[analytics/overview]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/analytics/feed?days=7
router.get('/feed', analyticsAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    res.json({ ok: true, ...(await svc.getFeedMetrics(days)) });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/analytics/boost?days=30
router.get('/boost', analyticsAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    res.json({ ok: true, ...(await svc.getBoostFunnel(days)) });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/analytics/commerce-funnel?days=30
router.get('/commerce-funnel', analyticsAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    res.json({ ok: true, ...(await svc.getCommerceFunnel(days)) });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/analytics/commerce/:commerceId?days=30
router.get('/commerce/:commerceId', analyticsAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await svc.getCommerceStats(req.params.commerceId, days);
    if (!data) return res.status(400).json({ ok: false, error: 'commerceId inválido' });
    res.json({ ok: true, ...data });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
