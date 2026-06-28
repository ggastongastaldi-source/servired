module.exports = {
  name: 'analisis_aladdin',
  canHandle(ctx) {
    return ['pulse','ventas','productos','inteligencia'].includes(ctx.modulo);
  },
  async execute(ctx) {
    return {
      data: null,
      summary: `Análisis Aladdín pendiente para módulo ${ctx.modulo}. Sin datos predictivos disponibles.`,
      cost: 'low'
    };
  }
};
