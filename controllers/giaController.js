'use strict';

const { buildUserState }         = require('../services/giaStateReader');
const { computePriorityAction }  = require('../services/priorityEngine');

// GET /api/gia/priority — retorna la priorityAction del usuario
exports.getPriorityAction = async (req, res) => {
  try {
    const state  = await buildUserState(req.userId);
    if (!state) return res.status(404).json({ error: 'Usuario no encontrado' });

    const action = computePriorityAction(state);
    res.json({ action, state: { rol: state.rol, ts: state.ts } });
  } catch (e) {
    console.error('[GIA] getPriorityAction error:', e);
    res.status(500).json({ error: 'Error al calcular prioridad' });
  }
};

// GET /api/gia/health
exports.health = (_req, res) => res.json({
  status: 'OK', module: 'gia', ts: new Date().toISOString()
});
