const express = require('express');
const router  = express.Router();
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/authMiddleware');

const TRANSICIONES_VALIDAS = {
  pendiente:  ['aprobado', 'rechazado'],
  aprobado:   ['ejecutado', 'error']
};

async function transicionar(id, nuevoEstado, extra = {}) {
  const evento = await ActivityLog.findById(id);
  if (!evento) return null;
  const permitidos = TRANSICIONES_VALIDAS[evento.estado] || [];
  if (!permitidos.includes(nuevoEstado)) {
    throw new Error(`Transición inválida: ${evento.estado} → ${nuevoEstado}`);
  }
  Object.assign(evento, { estado: nuevoEstado, ...extra });
  await evento.save();
  return evento;
}

router.get('/:comercioId', auth, async (req, res) => {
  try {
    const { comercioId } = req.params;
    const { limite = 50, modulo, nivelRiesgo, soloConfirmaciones } = req.query;
    const query = { comercioId };
    if (modulo) query.modulo = modulo;
    if (nivelRiesgo) query.nivelRiesgo = nivelRiesgo;
    if (soloConfirmaciones === 'true') {
      query.nivelRiesgo = 'requiere_confirmacion';
      query.estado = 'pendiente';
    }
    const eventos = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(parseInt(limite));
    const pendientes = await ActivityLog.countDocuments({
      comercioId, nivelRiesgo: 'requiere_confirmacion', estado: 'pendiente'
    });
    res.json({ ok: true, eventos, pendientes });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const evento = new ActivityLog(req.body);
    await evento.save();
    res.json({ ok: true, evento });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.patch('/:id/aprobar', auth, async (req, res) => {
  try {
    const e = await transicionar(req.params.id, 'aprobado');
    if (!e) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, evento: e });
  } catch(err) { res.status(400).json({ ok: false, error: err.message }); }
});

router.patch('/:id/rechazar', auth, async (req, res) => {
  try {
    const e = await transicionar(req.params.id, 'rechazado');
    if (!e) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, evento: e });
  } catch(err) { res.status(400).json({ ok: false, error: err.message }); }
});

router.patch('/:id/ejecutado', auth, async (req, res) => {
  try {
    const e = await transicionar(req.params.id, 'ejecutado', {
      executor: req.body.executor,
      resultadoEjecucion: req.body.resultado
    });
    if (!e) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, evento: e });
  } catch(err) { res.status(400).json({ ok: false, error: err.message }); }
});

router.patch('/:id/error', auth, async (req, res) => {
  try {
    const e = await transicionar(req.params.id, 'error', {
      errorCode:    req.body.errorCode,
      errorMessage: req.body.errorMessage
    });
    if (!e) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, evento: e });
  } catch(err) { res.status(400).json({ ok: false, error: err.message }); }
});

module.exports = router;
