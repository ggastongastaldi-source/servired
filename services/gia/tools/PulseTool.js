const BusinessProfile = require('../../../models/BusinessProfile');

module.exports = {
  name: 'estado_pulse',
  canHandle(ctx) { return ctx.modulo === 'pulse' || ctx.modulo === 'sistema'; },
  async execute(ctx) {
    try {
      const perfil = await BusinessProfile.findById(ctx.comercioId).lean();
      if (!perfil) return { data: null, summary: 'Comercio no encontrado.', cost: 'low' };
      return {
        data: perfil,
        summary: `Comercio: ${perfil.nombreComercio || perfil.nombre}. Categoría: ${perfil.categoria || 'no especificada'}. Estado: activo.`,
        cost: 'low'
      };
    } catch(e) {
      return { data: null, summary: 'Error obteniendo estado del comercio.', cost: 'low' };
    }
  }
};
