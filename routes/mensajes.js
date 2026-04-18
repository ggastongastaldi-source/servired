const express = require('express');
const router  = express.Router();
const Mensaje = require('../models/Mensaje');
const { verificarToken } = require('../middleware/auth');

router.get('/sala/:salaId', verificarToken, async (req, res) => {
  try {
    const msgs = await Mensaje.find({ salaId: req.params.salaId }).sort({ creadoEn: 1 }).limit(100);
    res.json({ ok: true, mensajes: msgs });
  } catch(e){ res.status(500).json({ ok:false, error: e.message }); }
});

router.post('/leidos/:salaId', verificarToken, async (req, res) => {
  try {
    await Mensaje.updateMany(
      { salaId: req.params.salaId, remitente: { $ne: req.usuario.id }, leido: false },
      { $set: { leido: true } }
    );
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ ok:false, error: e.message }); }
});

module.exports = router;
