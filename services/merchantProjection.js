/**
 * MerchantProjection v1.0
 * Proyección derivada del Event Store para el módulo Merchant.
 * Lee eventos de SINAPSIS — NUNCA escribe sobre el Core.
 * Alimenta: Dashboard, Analytics, KPIs, Boost, Campañas.
 */
const BusinessProfile = require('../models/BusinessProfile');
const CatalogItem     = require('../models/CatalogItem');
const MarketingEvent  = require('../models/MarketingEvent');

// ── Proyección principal de un comercio ────────────────────────────────────
async function projectMerchantState(usuarioId) {
  const [profile, items] = await Promise.all([
    BusinessProfile.findOne({ usuarioId }),
    CatalogItem.find({ usuarioId, estado: 'ACTIVO' }).lean()
  ]);

  if (!profile) return null;

  // Ventana temporal
  const ahora     = new Date();
  const inicioHoy = new Date(ahora); inicioHoy.setHours(0,0,0,0);
  const inicioSem = new Date(ahora); inicioSem.setDate(ahora.getDate() - 7);
  const inicioMes = new Date(ahora); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);

  // Eventos de marketing para este comercio
  const [eventosHoy, eventosSem, eventosMes] = await Promise.all([
    MarketingEvent.find({ 'properties.merchantId': String(profile._id), timestamp: { $gte: inicioHoy } }).lean(),
    MarketingEvent.find({ 'properties.merchantId': String(profile._id), timestamp: { $gte: inicioSem } }).lean(),
    MarketingEvent.find({ 'properties.merchantId': String(profile._id), timestamp: { $gte: inicioMes } }).lean()
  ]);

  // KPIs calculados
  const vistasHoy      = eventosHoy.filter(e => e.eventType === 'commerce_feed_view').length;
  const solicitudesHoy = eventosHoy.filter(e => e.eventType === 'boost_initiated').length;
  const conversionMes  = calcConversion(eventosMes);
  const topProductos   = calcTopProductos(eventosMes, items);
  const boostActivos   = eventosSem.filter(e => e.eventType === 'boost_completed').length;

  return {
    merchantId:   profile._id,
    nombreComercial: profile.nombreComercial,
    estado:       profile.estado,
    verificado:   profile.verificado,
    logo:         profile.logo,
    zonaId:       profile.zonaId,

    actividad: {
      vistasHoy,
      solicitudesHoy,
      pedidosConcretados: profile.metricas.pedidosConcretados,
      calificacion:       profile.metricas.calificacionPromedio
    },

    catalogo: {
      totalItems:    items.length,
      enPromocion:   items.filter(i => i.enPromocion).length,
      sinStock:      items.filter(i => i.stock !== null && i.stock === 0).length,
      topProductos
    },

    campanias: {
      activas:        boostActivos,
      vistasGeneradas: vistasHoy,
      conversionRate:  conversionMes
    },

    ingresos: {
      estimadoMes: 0,   // placeholder — se conecta con Ledger en P7
      moneda: 'ARS'
    },

    tendencia: {
      vistasUltimos7dias: agruparPorDia(eventosSem.filter(e => e.eventType === 'commerce_feed_view')),
      solicitudesUltimos7dias: agruparPorDia(eventosSem.filter(e => e.eventType === 'boost_initiated'))
    },

    proyectadoEn: ahora.toISOString()
  };
}

// ── Helpers deterministas (sin side effects) ───────────────────────────────
function calcConversion(eventos) {
  const vistas  = eventos.filter(e => e.eventType === 'commerce_feed_view').length;
  const boosts  = eventos.filter(e => e.eventType === 'boost_completed').length;
  if (!vistas) return 0;
  return Math.round((boosts / vistas) * 10000) / 100; // porcentaje con 2 decimales
}

function calcTopProductos(eventos, items) {
  const conteo = {};
  eventos.forEach(e => {
    const pid = e.properties?.itemId;
    if (pid) conteo[pid] = (conteo[pid] || 0) + 1;
  });
  return items
    .map(i => ({ ...i, _score: conteo[String(i._id)] || 0 }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(i => ({ id: i._id, nombre: i.nombre, vistas: i._score, precio: i.precioARS }));
}

function agruparPorDia(eventos) {
  const mapa = {};
  eventos.forEach(e => {
    const dia = new Date(e.timestamp).toISOString().slice(0,10);
    mapa[dia] = (mapa[dia] || 0) + 1;
  });
  // Últimos 7 días completos
  const resultado = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    resultado.push({ fecha: key, cantidad: mapa[key] || 0 });
  }
  return resultado;
}

module.exports = { projectMerchantState };
