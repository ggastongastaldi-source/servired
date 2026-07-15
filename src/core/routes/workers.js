const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const Worker = require('../../models/worker.model');
const Usuario = require('../models/Usuario');
const SECRET = process.env.JWT_SECRET;

// Middleware: verificar JWT
function authJWT(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ ok: false, error: 'Sin token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Token inválido' });
  }
}

// POST /api/workers/session
// Llamado por trabajador.html justo después del login JWT normal.
// Crea o actualiza el Worker en GR3 y devuelve el reconnectToken.
router.post('/session', authJWT, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    // Leer datos del usuario para poblar el Worker
    const usuario = await Usuario.findById(userId);
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    if (usuario.rol !== 'TRABAJADOR') return res.status(403).json({ ok: false, error: 'Solo trabajadores' });

    const workerId = userId.toString();

    // Upsert: crea el Worker si no existe, actualiza rubros/zona si cambió
    await Worker.findOneAndUpdate(
      { workerId },
      {
        $setOnInsert: { workerId },
        $set: {
          'dispatch.rubros': usuario.especialidades || [],
          'dispatch.zona':   usuario.zona           || 'sin_zona',
        },
      },
      { upsert: true }
    );

    // Emitir nuevo reconnectToken (válido 8h)
    const { rawToken, version } = await Worker.issueReconnectToken(workerId);

    // Telemetría: oferta del mercado — trabajador disponible
    try {
      const { emitEvent } = require('../../../nexus/events/emitEvent');
      emitEvent({
        entityType: 'worker',
        type:       'WORKER_SESSION_STARTED',
        aggregateId: workerId,
        payload: {
          rubros:    usuario.especialidades || [],
          zona:      usuario.zona           || null,
          channel:   'app',
        }
      });
    } catch(_) {}

    res.json({ ok: true, workerId, reconnectToken: rawToken, reconnectTokenVersion: version });
  } catch (e) {
    console.error('[GR3] /api/workers/session error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
