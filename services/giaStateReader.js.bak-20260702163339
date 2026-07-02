/**
 * GIA StateReader v1.0
 *
 * Construye el UserState que consume el PriorityEngine.
 * Lee únicamente desde:
 *   - MerchantProjection (read model)
 *   - Usuario model (estado de usuario)
 *   - Pedido model (estado de pedidos activos)
 *
 * NUNCA modifica el Core.
 * NUNCA escribe en base de datos.
 */
'use strict';

const Usuario            = require('../models/Usuario');
const MerchantProjection = require('../models/MerchantProjection');

async function buildUserState(userId) {
  const usuario = await Usuario.findById(userId).lean();
  if (!usuario) return null;

  const rol = detectarRol(usuario);

  const state = {
    userId:  String(userId),
    rol,
    ts:      new Date().toISOString()
  };

  switch (rol) {
    case 'worker':   state.worker   = await buildWorkerState(usuario);   break;
    case 'cliente':  state.cliente  = await buildClienteState(usuario);  break;
    case 'merchant': state.merchant = await buildMerchantState(usuario); break;
  }

  return state;
}

// ── Detección de rol ───────────────────────────────────────────────────────
function detectarRol(usuario) {
  // Orden de prioridad: merchant > worker > cliente
  if (usuario.rol === 'comercio' || usuario.tipo === 'comercio') return 'merchant';
  if (usuario.rol === 'tecnico'  || usuario.tipo === 'tecnico')  return 'worker';
  return 'cliente';
}

// ── Estado Worker ──────────────────────────────────────────────────────────
async function buildWorkerState(usuario) {
  let pedidoActivo = null;

  try {
    // Pedido model puede no estar disponible — falla silenciosamente
    const Pedido = require('../models/Pedido');
    pedidoActivo = await Pedido.findOne({
      workerId: usuario._id,
      estado:   { $in: ['ASIGNADO', 'EN_CAMINO', 'EN_CURSO', 'FINALIZADO'] }
    }).sort({ updatedAt: -1 }).lean();

    if (pedidoActivo) {
      pedidoActivo = {
        id:                    String(pedidoActivo._id),
        etapa:                 pedidoActivo.estado,
        servicio:              pedidoActivo.descripcion || pedidoActivo.tipo,
        direccion:             pedidoActivo.direccionCliente,
        montoFinal:            pedidoActivo.montoFinal || pedidoActivo.precio,
        pagoCobrado:           !!pedidoActivo.pagoCobrado,
        llegadaConfirmada:     !!pedidoActivo.llegadaConfirmada,
        minutos_transcurridos: Math.round((Date.now() - new Date(pedidoActivo.updatedAt)) / 60000)
      };
    }
  } catch (_) { /* Pedido model aún no existe — ignorar */ }

  return {
    pedidoActivo,
    saldo: {
      disponible: usuario.wallet_available ?? 0,
      pendiente:  usuario.wallet_pending   ?? 0
    },
    matches: [], // DispatchEngine / Glóbulo Rojo los inyecta en tiempo real
    perfil: {
      completitud: calcularCompletitudWorker(usuario),
      zonaId:      usuario.zona || usuario.zonaId,
      nombre:      usuario.nombre
    }
  };
}

// ── Estado Cliente ─────────────────────────────────────────────────────────
async function buildClienteState(usuario) {
  let pedidoActivo = null, pendienteCalificar = null;

  try {
    const Pedido = require('../models/Pedido');

    pedidoActivo = await Pedido.findOne({
      clienteId: usuario._id,
      estado:    { $in: ['EN_CAMINO', 'EN_CURSO'] }
    }).lean();

    if (pedidoActivo) {
      pedidoActivo = {
        id:          String(pedidoActivo._id),
        etapa:       pedidoActivo.estado,
        workerNombre:pedidoActivo.workerNombre,
        workerId:    String(pedidoActivo.workerId),
        etaMinutos:  pedidoActivo.etaMinutos || 0
      };
    }

    // Pendiente de calificar: finalizado en últimas 24hs sin calificación
    const hace24h = new Date(Date.now() - 86400000);
    const sinCalificar = await Pedido.findOne({
      clienteId:      usuario._id,
      estado:         'FINALIZADO',
      calificado:     { $ne: true },
      updatedAt:      { $gte: hace24h }
    }).lean();

    if (sinCalificar) {
      pendienteCalificar = {
        id:          String(sinCalificar._id),
        workerNombre:sinCalificar.workerNombre,
        expiraEn:    new Date(new Date(sinCalificar.updatedAt).getTime() + 86400000).toISOString()
      };
    }
  } catch (_) { /* Pedido model aún no existe */ }

  return {
    pedidoActivo,
    pendienteCalificar,
    ultimoProblema: null // futuro: conectar con historial
  };
}

// ── Estado Merchant ────────────────────────────────────────────────────────
async function buildMerchantState(usuario) {
  let projection = null;

  try {
    const BusinessProfile = require('../models/BusinessProfile');
    const profile = await BusinessProfile.findOne({ usuarioId: usuario._id }).lean();
    if (profile) {
      projection = await MerchantProjection.findOne({ merchantId: profile._id }).lean();
    }
  } catch (_) { /* silencioso */ }

  return {
    projection: projection ? {
      estado:    projection.estado,
      catalogo:  projection.catalogo,
      actividad: projection.dashboard,
      zonaId:    projection.zonaId
    } : null,
    campanias: {
      vencidaConROI: null // futuro: conectar con módulo de campañas
    }
  };
}

// ── Completitud del perfil worker ──────────────────────────────────────────
function calcularCompletitudWorker(u) {
  const campos = ['nombre', 'apellido', 'telefono', 'email', 'zona', 'especialidades', 'foto'];
  const completos = campos.filter(c => u[c] && (Array.isArray(u[c]) ? u[c].length > 0 : true));
  return Math.round((completos.length / campos.length) * 100);
}

module.exports = { buildUserState };
