const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const orchestrator = require('../services/gia/GiaOrchestrator');

router.post('/consulta', requireAuth, async (req, res) => {
  try {
    const { mensaje, modulo, comercioId } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!mensaje) return res.status(400).json({ ok: false, error: 'mensaje requerido' });

    const { respuesta, tokensUsed } = await orchestrator.consultar({
      userId,
      comercioId,
      modulo: modulo || 'sistema',
      mensaje,
      perfil: 'comerciante'
    });

    res.json({ ok: true, respuesta, tokensUsed });
  } catch(err) {
    console.error('[GIA] Error en consulta:', err.message);
    res.status(500).json({ ok: false, respuesta: 'G.I.A. no está disponible en este momento.' });
  }
});

router.delete('/conversacion/:comercioId', requireAuth, async (req, res) => {
  try {
    const GiaConversation = require('../models/GiaConversation');
    await GiaConversation.deleteOne({
      comercioId: req.params.comercioId,
      userId: req.user?._id || req.user?.id
    });
    res.json({ ok: true });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
