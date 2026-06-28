const MerchantProjection = require('../../../models/MerchantProjection');

module.exports = {
  name: 'analisis_aladdin',

  canHandle(ctx) {
    return ['pulse','ventas','productos','inteligencia'].includes(ctx.modulo) && !!ctx.comercioId;
  },

  async execute(ctx) {
    try {
      const proj = await MerchantProjection.findOne({ merchantId: ctx.comercioId }).lean();
      if (!proj) return { data: null, summary: 'Sin proyección disponible para este comercio.', cost: 'low' };

      const d = proj.dashboard || {};
      const c = proj.catalogo  || {};

      const alertas = [];
      if (c.sinStock > 0)          alertas.push(`${c.sinStock} producto(s) sin stock`);
      if (d.solicitudesHoy === 0)  alertas.push('Sin solicitudes hoy');
      if (d.calificacionPromedio < 3.5 && d.calificacionPromedio > 0) alertas.push('Calificación por debajo de 3.5');

      const summary =
        `Ventas/solicitudes hoy: ${d.solicitudesHoy}. ` +
        `Pedidos concretados: ${d.pedidosConcretados}. ` +
        `Ingresos estimados este mes: $${d.ingresosEstimadoMes?.toLocaleString('es-AR') || 0} ARS. ` +
        `Calificación promedio: ${d.calificacionPromedio || 'sin datos'}. ` +
        `Catálogo: ${c.totalItems} items, ${c.enPromocion} en promoción, ${c.sinStock} sin stock. ` +
        (alertas.length ? `Alertas: ${alertas.join(', ')}.` : 'Sin alertas críticas.');

      return { data: proj, summary, cost: 'low' };
    } catch(e) {
      return { data: null, summary: 'Error consultando Aladdín: ' + e.message, cost: 'low' };
    }
  }
};
