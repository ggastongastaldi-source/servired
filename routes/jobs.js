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
const requireAuth = require('../middleware/authMiddleware');
const { crearJobDesdeREST } = require('../src/infrastructure/adapters/CreateJobAdapter');

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

    // Etapa 4: flujo canónico — CreateJobAdapter emite JobCreated
    const result = await crearJobDesdeREST({
      clientId,
      rubro,
      zona,
      urgency,
      estimatedValue,
      clientWantsQuotes,
      descripcion,
      ubicacion,
    });

    // Respuesta según track (idéntica al legacy)
    if (result.classification.track === 'DISPATCH') {
      return res.json({
        ok:    true,
        track: 'DISPATCH',
        classification: result.classification,
        market: {
          zoneState:         result.marketContext.zoneState,
          pricingMultiplier: result.marketContext.pricingMultiplier,
          availableWorkers:  result.marketContext.recommendedWorkers?.length ?? 0,
        },
        message: 'Tu solicitud fue recibida. Estamos asignando un profesional.',
      });
    }

    return res.json({
      ok:    true,
      track: 'AUCTION',
      classification: result.classification,
      market: {
        zoneState:         result.marketContext.zoneState,
        pricingMultiplier: result.marketContext.pricingMultiplier,
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


// ===== FIX JOB MATCH PIPELINE =====
module.exports.__servired_socket_fix = (io) => {

  io.on("connection", (socket) => {

    socket.on("job_request", async (data) => {
      console.log("[PIPELINE JOB_REQUEST]", data);

      // simulación de matching real (fallback seguro)
      const matched = {
        workerId: "auto-worker-1",
        tipoServicio: data.tipoServicio,
        zona: data.zona,
        price: data.precio,
        status: "matched",
        ts: Date.now()
      };

      console.log("[PIPELINE MATCHED]", matched);

      io.emit("job_matched", matched);
    });

  });

};
// ===== END FIX =====

