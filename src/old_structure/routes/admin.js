const router = require('express').Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'servired_secret';

function authAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const p = jwt.verify(token, SECRET);
    if (p.rol !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
    req.admin = p;
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// Pedidos
router.get('/pedidos', authAdmin, async (req, res) => {
  try {
    const pedidos = await mongoose.connection.db.collection('pedidos')
      .find({}).sort({createdAt:-1}).limit(50).toArray();
    res.json({ ok: true, data: pedidos });
  } catch(e) { res.json({ ok: true, data: [] }); }
});

// Trabajadores
router.get('/trabajadores', authAdmin, async (req, res) => {
  try {
    const trabajadores = await mongoose.connection.db.collection('usuarios')
      .find({ rol: 'TRABAJADOR' }).sort({createdAt:-1}).toArray();
    res.json({ ok: true, data: trabajadores });
  } catch(e) { res.json({ ok: true, data: [] }); }
});

// Verificar trabajador
router.post('/trabajadores/:id/verificar', authAdmin, async (req, res) => {
  try {
    await mongoose.connection.db.collection('usuarios').updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { estado: 'VERIFICADO', verificado: true } }
    );
    // Notificar por socket
    if (global._io) {
      global._io.to('admins').emit('trabajador_verificado', { id: req.params.id });
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Stats
router.get('/stats', authAdmin, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const [pedidos, trabajadores, clientes] = await Promise.all([
      db.collection('pedidos').countDocuments(),
      db.collection('usuarios').countDocuments({ rol: 'TRABAJADOR' }),
      db.collection('usuarios').countDocuments({ rol: 'CLIENTE' }),
    ]);
    res.json({ ok: true, pedidos, trabajadores, clientes });
  } catch(e) { res.json({ ok: true, pedidos: 0, trabajadores: 0, clientes: 0 }); }
});

module.exports = router;
