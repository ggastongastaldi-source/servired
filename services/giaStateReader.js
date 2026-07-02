/**
 * GIA StateReader v1.1 — FIX: alineado al schema real de Pedido
 *
 * Bug corregido (julio 2026): consultaba workerId/clienteId y estados
 * ASIGNADO/EN_CAMINO/EN_CURSO/FINALIZADO que NO existen en el modelo real
 * (src/core/models/Pedido.js usa worker/cliente y
 * PENDIENTE/SEARCHING/EXPANDING_RADIUS/ACEPTADA/EN_PROCESO/REALIZADA/CERRADA/CANCELADA).
 * Como consecuencia, pedidoActivo devolvía siempre null para worker y cliente.
 *
 * Construye el UserState que consume el PriorityEngine.
 * Lee únicamente desde:
 *   - MerchantProjection (read model)
 *   - Usuario model (estado de usuario)
 *   - Pedido model (estado de pedidos activos)
 *
 * NUNCA modifica el Core.
 * NUNCA escribe en base de datos.
 *
 * TODOs pendientes (requieren Discovery Pass adicional antes de refinar):
 *   - llegadaConfirmada: no existe campo en el schema de Pedido. Hoy se
 *     asume false. Si existe un evento de "llegada" real, probablemente
 *     esté en pedido.timeline[] — no auditado todavía.
 *   - etaMinutos (cliente): no existe campo ETA en el schema. Hoy se
 *     devuelve 0. Confirmar si GlobuloRojo/dispatch calcula un ETA en
 *     algún otro lado antes de mostrar un número real en la UI.
 *   - expiraEn (pendienteCalificar): el schema no tiene timestamps
 *     automáticos (no usa { timestamps: true }), por eso se usa
 *     fechaCreacion en vez de updatedAt como aproximación.
 */
'use strict';

const Usuario            = require('../models/Usuario');
const MerchantProjection = require('../models/MerchantProjection');
const { analyze: marketFieldAnalyze } = require('./marketField/marketFieldEngine');
const { computePricing }              = require('./pricing/pricingPolicyEngine');
const AladdinInsight                  = require('../models/AladdinInsight');

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
  if (usuario.rol === 'comercio' || usuario.tipo === 'comercio') return 'merchant';
  if (usuario.rol === 'tecnico'  || usuario.tipo === 'tecnico')  return 'worker';
  return 'cliente';
}

// Traduce el estado real del schema al vocabulario que espera PriorityEngine
// (PriorityEngine se mantiene intacto — es función pura con tests pasando —
// la traducción vive acá, no ahí).
const ETAPA_MAP_WORKER = Object.freeze({
  ACEPTADA:   'ASIGNADO',
  EN_PROCESO: 'EN_CURSO',
  REALIZADA:  'FINALIZADO'
});

// ── Estado Worker ──────────────────────────────────────────────────────────
async function buildWorkerState(usuario) {
  let pedidoActivo = null;

  try {
    const Pedido = require('../models/Pedido');
    const raw = await Pedido.findOne({
      worker: usuario._id,
      estado: { $in: ['ACEPTADA', 'EN_PROCESO', 'REALIZADA'] }
    }).sort({ fechaCreacion: -1 }).lean();

    if (raw) {
      const pagado = ['PAID', 'HELD', 'RELEASED'].includes(raw.payment_status);

      pedidoActivo = {
        id:                    String(raw._id),
        etapa:                 ETAPA_MAP_WORKER[raw.estado] || raw.estado,
        servicio:              raw.descripcion || raw.tipoServicio,
        direccion:             raw.direccion,
        montoFinal:            raw.total_estimado || raw.precio || 0,
        pagoCobrado:           pagado,
        llegadaConfirmada:     false, // TODO — ver nota de cabecera
        minutos_transcurridos: raw.fechaCreacion
          ? Math.round((Date.now() - new Date(raw.fechaCreacion)) / 60000)
          : 0
      };
    }
  } catch (_) { /* Pedido model no disponible — degradación segura */ }

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

    const raw = await Pedido.findOne({
      cliente: usuario._id,
      estado:  { $in: ['ACEPTADA', 'EN_PROCESO'] }
    }).populate('worker', 'nombre').lean();

    if (raw) {
      pedidoActivo = {
        id:           String(raw._id),
        etapa:        'EN_CAMINO', // ACEPTADA/EN_PROCESO = seguimiento activo para el cliente
        workerNombre: raw.worker?.nombre || 'tu profesional',
        workerId:     raw.worker ? String(raw.worker._id || raw.worker) : null,
        etaMinutos:   0 // TODO — ver nota de cabecera
      };
    }

    const hace24h = new Date(Date.now() - 86400000);
    const sinCalificar = await Pedido.findOne({
      cliente:             usuario._id,
      estado:              'REALIZADA',
      calificacionCliente: null,
      fechaCreacion:        { $gte: hace24h }
    }).populate('worker', 'nombre').lean();

    if (sinCalificar) {
      pendienteCalificar = {
        id:           String(sinCalificar._id),
        workerNombre: sinCalificar.worker?.nombre || 'tu profesional',
        expiraEn:     new Date(new Date(sinCalificar.fechaCreacion).getTime() + 86400000).toISOString()
      };
    }
  } catch (_) { /* Pedido model no disponible */ }

  return {
    pedidoActivo,
    pendienteCalificar,
    ultimoProblema: null // futuro: conectar con historial
  };
}

// ── Contexto de mercado (Fase 2 — julio 2026) ───────────────────────────────
// Enriquece el estado merchant reutilizando motores ya existentes.
// Solo lectura. Degradación segura por fuente: si un motor falla, esa
// porción queda null y las demás se intentan igual. No decide nada —
// computePriorityAction sigue siendo el único lugar que decide (ADR-003).
async function buildMarketContext(zonaId, rubroId) {
  const context = { zonaId: zonaId || null, rubroId: rubroId || null, marketField: null, pricing: null, insight: null };
  if (!zonaId) return context;

  try {
    context.marketField = await marketFieldAnalyze({ zoneId: zonaId, rubro: rubroId });
  } catch (_) { /* MarketFieldEngine no disponible */ }

  try {
    context.pricing = await computePricing({ zoneId: zonaId, rubroId: rubroId || null });
  } catch (_) { /* PricingPolicyEngine no disponible */ }

  try {
    const filtro = { status: 'active', zonaId };
    if (rubroId) filtro.rubroId = rubroId;
    context.insight = await AladdinInsight.findOne(filtro)
      .sort({ generatedAt: -1 })
      .select('insightType confidence message generatedAt')
      .lean();
  } catch (_) { /* AladdinInsight no disponible */ }

  return context;
}

// ── Estado Merchant ────────────────────────────────────────────────────────
async function buildMerchantState(usuario) {
  let projection = null;
  let marketContext = null;

  try {
    const BusinessProfile = require('../models/BusinessProfile');
    const profile = await BusinessProfile.findOne({ usuarioId: usuario._id }).lean();
    if (profile) {
      projection = await MerchantProjection.findOne({ merchantId: profile._id }).lean();
      marketContext = await buildMarketContext(profile.zonaId, profile.rubroId);
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
    },
    marketContext // { zonaId, rubroId, marketField, pricing, insight } — null-safe
  };
}

// ── Completitud del perfil worker ──────────────────────────────────────────
function calcularCompletitudWorker(u) {
  const campos = ['nombre', 'apellido', 'telefono', 'email', 'zona', 'especialidades', 'foto'];
  const completos = campos.filter(c => u[c] && (Array.isArray(u[c]) ? u[c].length > 0 : true));
  return Math.round((completos.length / campos.length) * 100);
}

module.exports = { buildUserState };
