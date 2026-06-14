const router = require('express').Router();
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;
const Referido = require('../../models/Referido');

function authAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const p = jwt.verify(token, SECRET);
    if (p.rol !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
    req.admin = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// GET /api/admin/referidos — embudo scans -> registros -> clientes/workers por comercio
router.get('/', authAdmin, async (req, res) => {
  try {
    const referidos = await Referido.find({}).sort({ 'stats.scans': -1 }).lean();
    res.json({ ok: true, data: referidos });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// POST /api/admin/referidos - crear comercio aliado
// ref_code se deriva de _id (deterministico, inmutable, sin input de usuario,
// sin persistencia redundante: es el mismo campo ya existente en el schema).
router.post('/', authAdmin, async (req, res) => {
  try {
    const { nombre, zona, tipo } = req.body || {};
    if (!nombre || !zona) {
      return res.status(400).json({ ok: false, error: 'nombre y zona son requeridos' });
    }

    const doc = new Referido({ nombre, zona, tipo: tipo || 'otro' });
    doc.ref_code = doc._id.toString().toUpperCase();
    await doc.save();

    res.json({ ok: true, data: doc });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
module.exports = router;
