const ActivityLog = require('../../../models/ActivityLog');

module.exports = {
  name: 'actividad_reciente',
  canHandle(ctx) { return !!ctx.comercioId; },
  async execute(ctx) {
    const eventos = await ActivityLog.find({ comercioId: ctx.comercioId })
      .sort({ timestamp: -1 }).limit(10).lean();
    const pendientes = eventos.filter(e => e.estado === 'pendiente').length;
    const summary = eventos.length === 0
      ? 'Sin actividad reciente registrada.'
      : `Últimos ${eventos.length} eventos. ` +
        (pendientes > 0 ? `${pendientes} acción(es) esperando aprobación. ` : '') +
        eventos.slice(0, 3).map(e => e.descripcion).join(' | ');
    return { data: eventos, summary, cost: 'low' };
  }
};
