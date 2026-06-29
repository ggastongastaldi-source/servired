/**
 * POST /api/jobs/request
 *
 * Entry point unificado para solicitudes de servicio.
 * JobClassifier decide el track (DISPATCH | AUCTION).
 * NO modifica lógica existente de quotes ni dispatch.
 */
"use strict";

const express       = require('express');
const router        = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { classifyJob } = require('../services/jobClassifier');
const { analyze }     = require('../services/marketField/marketFieldEngine');
const emitEvent       = require('../nexus/events/emitEvent');

/**
 * POST /api/jobs/request
 * Body: { rubro, zona, urgency?, estimatedValue?, clientWantsQuotes?, descripcion?, ubicacion? }
 */
router.post('/request', requireAuth, async (req, res) => {
  try {
    const {
      rubro,
      zona,
      urgency         = 'MEDIUM',
      estimatedValue  = 0,
      clientWantsQuotes = false,
      descripcion     = '',
      ubicacion,
    } = req.body;

    if (!rubro || !zona) {
      return res.status(400).json({ ok: false, error: 'rubro y zona son requeridos' });
    }

    const clientId = req.user._id?.toString() || req.user.id;

    // 1. Clasificar el job
    const classification = classifyJob({ rubro, urgency, estimatedValue, clientWantsQuotes });

    // 2. Leer estado del mercado (no modifica nada)
    const marketContext = await analyze({
      zoneId:      zona,
      rubro,
      jobLocation: ubicacion,
    });

    // 3. Emitir JOB_REQUESTED (fuente de verdad)
    await emitEvent({
      type:    'JOB_REQUESTED',
      actor:   clientId,
      context: 'job_router',
      payload: {
        clientId,
        rubro,
        zona,
        urgency,
        estimatedValue,
        descripcion,
        ubicacion,
        track:          classification.track,
        classifyReason: classification.reason,
        marketPressure: marketContext.marketPressure,
        zoneState:      marketContext.zoneState,
        pricingMultiplier: marketContext.pricingMultiplier,
      },
    });

    // 4. Respuesta según track
    if (classification.track === 'DISPATCH') {
      return res.json({
        ok:    true,
        track: 'DISPATCH',
        classification,
        market: {
          zoneState:        marketContext.zoneState,
          pricingMultiplier: marketContext.pricingMultiplier,
          availableWorkers:  marketContext.recommendedWorkers.length,
        },
        message: 'Tu solicitud fue recibida. Estamos asignando un profesional.',
      });
    }

    // AUCTION track
    return res.json({
      ok:    true,
      track: 'AUCTION',
      classification,
      market: {
        zoneState:        marketContext.zoneState,
        pricingMultiplier: marketContext.pricingMultiplier,
      },
      message: 'Tu solicitud fue recibida. Recibirás presupuestos de profesionales.',
      nextStep: 'POST /api/quotes con el requestId del evento emitido',
    });

  } catch(err) {
    console.error('[jobs/request]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/jobs/classify — utilidad de diagnóstico
 * Permite testear el clasificador sin crear jobs
 */
router.get('/classify', requireAuth, (req, res) => {
  const { rubro, urgency, estimatedValue, clientWantsQuotes } = req.query;
  const result = classifyJob({
    rubro,
    urgency,
    estimatedValue: Number(estimatedValue) || 0,
    clientWantsQuotes: clientWantsQuotes === 'true',
  });
  res.json({ ok: true, ...result });
});

module.exports = router;
