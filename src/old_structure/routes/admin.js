const router = require('express').Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

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

// Replay Runner — solo admin
router.post('/nexus/replay', authAdmin, async (req, res) => {
  try {
    const { replay } = require('../../../nexus/analytics/replayRunner');
    const { desde, hasta, borrarProjections, verbose } = req.body;
    console.log('[Admin] 🔄 Replay solicitado por admin');
    const result = await replay({ desde, hasta, borrarProjections: !!borrarProjections, verbose: !!verbose });
    res.json({ ok: true, result });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Stats de projections
router.get('/nexus/projections', authAdmin, async (req, res) => {
  try {
    const jobs    = await mongoose.connection.collection('proj_jobs').countDocuments();
    const leads   = await mongoose.connection.collection('proj_leads').countDocuments();
    const zonas   = await mongoose.connection.collection('proj_zona_metrics').find({}).toArray();
    const eventos = await mongoose.connection.collection('events').countDocuments();
    res.json({ ok: true, data: { jobs, leads, zonas, eventos } });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
