const express  = require('express');
const router   = express.Router();
const Referido = require('../models/Referido');

// GET /api/referidos/resolver?ref=FERRETERIA001
router.get('/resolver', async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.json({ comercio: null });
  try {
    const doc = await Referido.findOneAndUpdate(
      { ref_code: ref.toUpperCase(), activo: true },
      { $inc: { 'stats.scans': 1 } },
      { new: true }
    );
    if (!doc) return res.json({ comercio: null });
    res.json({ comercio: { nombre: doc.nombre, zona: doc.zona, tipo: doc.tipo } });
  } catch (e) {
    console.error('[Referidos] resolver:', e.message);
    res.json({ comercio: null });
  }
});

module.exports = router;
