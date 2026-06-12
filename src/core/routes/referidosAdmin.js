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

module.exports = router;
