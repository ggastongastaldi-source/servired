const CatalogItem = require('../../../models/CatalogItem');

module.exports = {
  name: 'catalogo_comercio',

  canHandle(ctx) {
    return ['productos','mostrador','pulse','sistema'].includes(ctx.modulo) && !!ctx.comercioId;
  },

  async execute(ctx) {
    try {
      const [sinStock, enPromo, total] = await Promise.all([
        CatalogItem.find({ merchantId: ctx.comercioId, stock: 0, estado: 'ACTIVO' }).select('nombre stock').limit(5).lean(),
        CatalogItem.find({ merchantId: ctx.comercioId, enPromocion: true, estado: 'ACTIVO' }).select('nombre precioARS precioPromo').limit(5).lean(),
        CatalogItem.countDocuments({ merchantId: ctx.comercioId, estado: 'ACTIVO' })
      ]);

      const summary =
        `Catálogo activo: ${total} productos. ` +
        (sinStock.length ? `Sin stock: ${sinStock.map(p => p.nombre).join(', ')}. ` : 'Sin productos agotados. ') +
        (enPromo.length  ? `En promoción: ${enPromo.map(p => p.nombre).join(', ')}.` : 'Sin promociones activas.');

      return { data: { sinStock, enPromo, total }, summary, cost: 'low' };
    } catch(e) {
      return { data: null, summary: 'Error consultando catálogo: ' + e.message, cost: 'low' };
    }
  }
};
