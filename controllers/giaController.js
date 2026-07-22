'use strict';

const { buildUserState }         = require('../services/giaStateReader');
const { computePriorityAction }  = require('../services/priorityEngine');

// GET /api/gia/priority — retorna la priorityAction del usuario
exports.getPriorityAction = async (req, res) => {
  try {
    const userId = req.user && (req.user.userId || req.user.id);
  if (!userId) {
      const Usuario = require('../models/Usuario');
      const actores = await Usuario.countDocuments();
      return res.json({
        topInsight: 'ServiRed conecta trabajadores, comercios y clientes en el AMBA.',
        recommendation: 'Registrate para acceder a inteligencia economica en tiempo real.',
        oportunidades: 0,
        riesgos: 0,
        actores,
        insights: 0,
        kpiInsights: actores
      });
    }
    const state  = await buildUserState(userId);
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
