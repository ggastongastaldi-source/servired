/**
 * merchantProjection v2.0
 * 
 * Lee únicamente desde MerchantProjection (read model persistido).
 * Si no existe la projection, la reconstruye on-demand y la persiste.
 * 
 * Garantía: el dashboard nunca recalcula desde eventos — solo lee.
 */
const MerchantProjection        = require('../models/MerchantProjection');
const BusinessProfile           = require('../models/BusinessProfile');
const { reconstruirProjection } = require('./merchantProjectionReactor');

async function projectMerchantState(usuarioId) {
  // 1. Buscar read model persistido
  const profile = await BusinessProfile.findOne({ usuarioId }).lean();
  if (!profile) return null;

  let proj = await MerchantProjection.findOne({ merchantId: profile._id }).lean();

  // 2. Si no existe o es muy antigua (>15 min), reconstruir
  const STALE_MS = 15 * 60 * 1000;
  const esAntigua = proj && (Date.now() - new Date(proj.actualizadaEn).getTime() > STALE_MS);

  if (!proj || esAntigua) {
    await reconstruirProjection(profile._id, usuarioId, null);
    proj = await MerchantProjection.findOne({ merchantId: profile._id }).lean();
  }

  if (!proj) return null;

  // 3. Mapear al contrato público del dashboard
  return {
    merchantId:      proj.merchantId,
    nombreComercial: proj.nombreComercial,
    estado:          proj.estado,
    verificado:      proj.verificado,
    logo:            proj.logo,
    zonaId:          proj.zonaId,

    actividad: {
      vistasHoy:           proj.dashboard.vistasHoy,
      solicitudesHoy:      proj.dashboard.solicitudesHoy,
      pedidosConcretados:  proj.dashboard.pedidosConcretados,
      calificacion:        proj.dashboard.calificacionPromedio
    },

    catalogo: {
      totalItems:   proj.catalogo.totalItems,
      enPromocion:  proj.catalogo.enPromocion,
      sinStock:     proj.catalogo.sinStock,
      topProductos: proj.catalogo.topProductos
    },

    campanias: {
      activas:        proj.campanias.activas,
      vistasGeneradas:proj.campanias.vistasGeneradas,
      conversionRate: proj.campanias.conversionRate
    },

    ingresos: {
      estimadoMes: proj.dashboard.ingresosEstimadoMes,
      moneda: 'ARS'
    },

    tendencia: {
      vistasUltimos7dias:      proj.analytics.vistasUltimos7diasSerie,
      solicitudesUltimos7dias: proj.analytics.solicitudesUltimos7diasSerie
    },

    proyectadoEn: proj.actualizadaEn
  };
}

module.exports = { projectMerchantState };
