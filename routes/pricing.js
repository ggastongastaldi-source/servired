// routes/pricing.js — Capa de decisión comercial: PRECIO
// Fase 1: solo lectura, solo admin. Sirve para validar el PricingPolicyEngine
// contra datos reales antes de exponerlo a comercios o al flujo de cotización.
// Mismo patrón de auth que routes/soc.js.

const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../src/core/middleware/auth');

// GET /api/pricing/recommendation?zoneId=...&rubroId=...
router.get('/recommendation', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { zoneId, rubroId } = req.query;
    if (!zoneId) {
      return res.status(400).json({ ok: false, error: 'zoneId es requerido' });
    }

    const { computePricing } = require('../services/pricing/pricingPolicyEngine');
    const result = await computePricing({ zoneId, rubroId: rubroId || null });

    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[PRICING/recommendation]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
