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

// POST /api/referidos/convertir
// Body: { ref_code, rol: 'worker' | 'cliente' }
router.post('/convertir', async (req, res) => {
  const { ref_code, rol } = req.body;
  if (!ref_code) return res.json({ ok: false });
  try {
    const inc = { 'stats.registros': 1 };
    if (rol === 'worker')  inc['stats.workers']  = 1;
    if (rol === 'cliente') inc['stats.clientes'] = 1;
    await Referido.findOneAndUpdate({ ref_code: ref_code.toUpperCase() }, { $inc: inc });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Referidos] convertir:', e.message);
    res.json({ ok: false });
  }
});

module.exports = router;
