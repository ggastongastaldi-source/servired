const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { ingestar, listar, prepararMensaje, stats } = require('../../../globuloRojo/leadEngine/leadEngine');
const Lead = require('../../../globuloRojo/leadEngine/Lead');

function authAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if (p.rol !== 'ADMIN') return res.status(403).json({ error: 'No autorizado' });
    next();
  } catch(e) { res.status(401).json({ error: 'Token inválido' }); }
}

// GET /api/leads — listar con filtros
router.get('/', authAdmin, async (req, res) => {
  try {
    const leads = await listar(req.query);
    res.json({ ok: true, data: leads });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/leads/stats
router.get('/stats', authAdmin, async (req, res) => {
  try {
    res.json({ ok: true, data: await stats() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads — crear lead manual
router.post('/', authAdmin, async (req, res) => {
  try {
    const result = await ingestar({ ...req.body, source: req.body.source || 'manual' });
    res.json({ ok: true, ...result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/leads/:id/estado — mutar estado
router.post('/:id/estado', authAdmin, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    await lead.mutarEstado(req.body.estado, req.body.actor || 'admin', req.body.nota || '');
    res.json({ ok: true, lead });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/leads/:id/mensaje — preparar mensaje de contacto
router.get('/:id/mensaje', authAdmin, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json({ ok: true, mensajes: prepararMensaje(lead) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
