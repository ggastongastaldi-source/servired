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
    // Workers online via Socket.IO rooms
    const io = global._io;
    const online = io
      ? [...(io.sockets.adapter.rooms||new Map())].filter(([k])=>k.startsWith('worker_')).length
      : 0;
    res.json({ ok: true, pedidos, trabajadores, clientes, online });
  } catch(e) { res.json({ ok: true, pedidos: 0, trabajadores: 0, clientes: 0, online: 0 }); }
});


// Eliminar (rechazar) trabajador
router.delete('/trabajadores/:id', authAdmin, async (req, res) => {
  try {
    await mongoose.connection.db.collection('usuarios').deleteOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) }
    );
    if (global._io) global._io.to('admins').emit('trabajador_eliminado', { id: req.params.id });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Desactivar trabajador
router.post('/trabajadores/:id/desactivar', authAdmin, async (req, res) => {
  try {
    await mongoose.connection.db.collection('usuarios').updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { estado: 'DESACTIVADO', activo: false } }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cancelar pedido
router.post('/pedidos/:id/cancelar', authAdmin, async (req, res) => {
  try {
    await mongoose.connection.db.collection('pedidos').updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { estado: 'CANCELADO' } }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Reasignar pedido
router.post('/pedidos/:id/reasignar', authAdmin, async (req, res) => {
  try {
    await mongoose.connection.db.collection('pedidos').updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { estado: 'PENDIENTE', trabajadorId: null } }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// Circuit Breaker status
router.get('/circuit-breaker', authAdmin, (req, res) => {
  try {
    const { getAll } = require('../../../nexus/infrastructure/circuitBreaker');
    res.json({ ok: true, circuits: getAll() });
  } catch(e) { res.json({ ok: true, circuits: [] }); }
});


// Outbox stats
router.get('/outbox/stats', authAdmin, async (req, res) => {
  try {
    const { stats } = require('../../../nexus/infrastructure/outbox');
    res.json({ ok: true, stats: await stats() });
  } catch(e) { res.json({ ok: true, stats: {} }); }
});


// Workflow Engine — replay y integrity check
router.get('/workflow/snapshot/:entityType/:id', authAdmin, async (req, res) => {
  try {
    const { loadSnapshot } = require('../../../nexus/application/workflowEngine');
    const snap = await loadSnapshot(req.params.entityType, req.params.id);
    res.json({ ok: true, snapshot: snap });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/workflow/integrity/:entityType/:id', authAdmin, async (req, res) => {
  try {
    const { checkIntegrity } = require('../../../nexus/application/workflowEngine');
    const result = await checkIntegrity(req.params.entityType, req.params.id);
    res.json({ ok: true, ...result });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


// Governance Layer
router.get('/governance/policies', authAdmin, (req, res) => {
  try {
    const { getPolicies } = require('../../../nexus/application/governanceLayer');
    res.json({ ok: true, policies: getPolicies() });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/governance/emergencia', authAdmin, (req, res) => {
  try {
    const { activarModoEmergencia } = require('../../../nexus/application/governanceLayer');
    activarModoEmergencia(req.body.motivo || 'activado manualmente');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/governance/emergencia', authAdmin, (req, res) => {
  try {
    const { desactivarModoEmergencia } = require('../../../nexus/application/governanceLayer');
    desactivarModoEmergencia();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.patch('/governance/politica', authAdmin, (req, res) => {
  try {
    const { actualizarPolitica } = require('../../../nexus/application/governanceLayer');
    actualizarPolitica(req.body.key, req.body.value);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


// Chaos Lab — SOLO para testing, nunca en producción automático
router.get('/chaos/faults', authAdmin, (req, res) => {
  try {
    const { listFaults } = require('../../../nexus/application/chaosLab');
    res.json({ ok: true, faults: listFaults() });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/chaos/inject/:fault', authAdmin, async (req, res) => {
  try {
    const { injectFault } = require('../../../nexus/application/chaosLab');
    const result = await injectFault(req.params.fault);
    res.json({ ok: true, result });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/chaos/validate', authAdmin, async (req, res) => {
  try {
    const { validate } = require('../../../nexus/application/chaosLab');
    const result = await validate();
    res.json({ ok: true, ...result });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


// NarrativeObserver — Marketing Outbox
router.get('/narrative/feed', authAdmin, async (req, res) => {
  try {
    const { getFeed } = require('../../../nexus/application/narrativeObserver');
    const feed = await getFeed(20);
    res.json({ ok: true, feed });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/narrative/trs', authAdmin, async (req, res) => {
  try {
    const { getTRSStats } = require('../../../nexus/application/narrativeObserver');
    res.json({ ok: true, stats: await getTRSStats() });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
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
