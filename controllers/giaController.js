'use strict';

const { buildUserState }        = require('../services/giaStateReader');
const { computePriorityAction } = require('../services/priorityEngine');

// Mapea urgencia del PriorityEngine al estado cognitivo que espera el frontend
function _urgenciaToState(urgencia) {
  switch (urgencia) {
    case 'CRITICA': return 'ALERTA';
    case 'ALTA':    return 'FOCUS';
    case 'MEDIA':   return 'ACTIVO';
    default:        return 'IDLE';
  }
}

// Traduce la priorityAction al shape que espera el frontend en d.action
function _toFrontendAction(pa) {
  if (!pa || pa.tipo === 'SIN_ACCION_CRITICA') return null;
  return {
    label:      pa.cta || pa.titulo,
    view:       _tipoToView(pa.tipo),
    titulo:     pa.titulo,
    descripcion: pa.descripcion,
    urgencia:   pa.urgencia,
    tipo:       pa.tipo
  };
}

// Mapea tipo de acción a la vista del OS que corresponde
function _tipoToView(tipo) {
  const map = {
    TRABAJO_CONFIRMAR_LLEGADA: 'profesional',
    TRABAJO_EN_CURSO:          'profesional',
    TRABAJO_FINALIZAR:         'profesional',
    COBRAR_SALDO:              'profesional',
    MATCH_DISPONIBLE:          'profesional',
    COMPLETAR_PERFIL_WORKER:   'profesional',
    ZONA_SIN_ACTIVIDAD:        'profesional',
    SEGUIR_PRESTADOR:          'cliente',
    CALIFICAR_TRABAJO:         'cliente',
    RESOLVER_PROBLEMA:         'cliente',
    PEDIDO_SIN_MATCH:          'cliente',
    RENOVAR_CAMPANIA:          'comercial',
    COMPLETAR_PERFIL_MERCHANT: 'comercial',
    SOLICITUDES_PENDIENTES:    'comercial',
    CATALOGO_VACIO:            'comercial',
    AUMENTAR_VISIBILIDAD:      'comercial'
  };
  return map[tipo] || 'gia-full';
}

// GET /api/gia/priority  (anónimo y autenticado — mismo endpoint)
exports.getPriorityAction = async (req, res) => {
  try {
    const userId = req.user && (req.user.userId || req.user.id);

    // ── Usuario anónimo ──────────────────────────────────────────────────
    if (!userId) {
      const Usuario = require('../models/Usuario');
      const actores = await Usuario.countDocuments();
      return res.json({
        topInsight:     'ServiRed conecta trabajadores, comercios y clientes en el AMBA.',
        recommendation: 'Registrate para acceder a inteligencia economica en tiempo real.',
        oportunidades:  0,
        riesgos:        0,
        actores,
        insights:       0,
        kpiInsights:    actores,
        state:          'IDLE',
        action:         null
      });
    }

    // ── Usuario autenticado ──────────────────────────────────────────────
    const userState = await buildUserState(userId);
    if (!userState) return res.status(404).json({ error: 'Usuario no encontrado' });

    const priorityAction = computePriorityAction(userState);
    const cognitiveState = _urgenciaToState(priorityAction.urgencia);

    // Extraer métricas del estado según rol para poblar los KPIs del frontend
    let oportunidades = 0, riesgos = 0, actores = 0, insights = 0;
    try {
      const rol = userState.rol;
      if (rol === 'merchant' && userState.merchant?.projection?.actividad) {
        const act = userState.merchant.projection.actividad;
        oportunidades = act.solicitudesHoy     || 0;
        riesgos       = act.alertasCriticas    || 0;
        insights      = act.vistasHoy          || 0;
      } else if (rol === 'worker' && userState.worker) {
        oportunidades = userState.worker.matches?.length || 0;
        riesgos       = userState.worker.saldo?.pendiente > 0 ? 1 : 0;
      } else if (rol === 'cliente' && userState.cliente) {
        oportunidades = userState.cliente.pedidoActivo ? 1 : 0;
        riesgos       = userState.cliente.ultimoProblema?.estado === 'ABIERTO' ? 1 : 0;
      }
      const Usuario = require('../models/Usuario');
      actores = await Usuario.countDocuments();
    } catch (_) { /* degradación segura — métricas quedan en 0 */ }

    return res.json({
      // Campos que espera el frontend (panel lateral + drawer)
      topInsight:     priorityAction.descripcion || priorityAction.titulo,
      recommendation: priorityAction.cta,
      oportunidades,
      riesgos,
      actores,
      insights,
      kpiInsights:    insights || actores,

      // Estado cognitivo (string simple que espera dataset.giaState)
      state: cognitiveState,

      // Acción principal traducida al shape del frontend
      action: _toFrontendAction(priorityAction),

      // Payload completo para consumo avanzado (gia-full, futuro chat)
      priorityAction
    });

  } catch (e) {
    console.error('[GIA] getPriorityAction error:', e);
    res.status(500).json({ error: 'Error al calcular prioridad' });
  }
};

// GET /api/gia/health
exports.health = (_req, res) => res.json({
  status: 'OK', module: 'gia', ts: new Date().toISOString()
});
