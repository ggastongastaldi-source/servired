
const Transaccion = require('../models/Transaccion');
const Pedido = require('../models/Pedido');

// Registrar transacción cuando worker marca trabajo como completado
async function registrarTransaccion(pedidoId) {
  try {
    const pedido = await Pedido.findById(pedidoId)
      .populate('cliente', '_id')
      .populate('worker', '_id');
    
    if (!pedido || !pedido.worker) {
      console.log('[FINANZAS] Pedido sin worker, skip:', pedidoId);
      return null;
    }
    
    // Evitar duplicados
    const existente = await Transaccion.findOne({ pedidoId });
    if (existente) {
      console.log('[FINANZAS] Transacción ya existe:', existente._id);
      return existente;
    }
    
    const transaccion = new Transaccion({
      pedidoId: pedido._id,
      clienteId: pedido.cliente._id || pedido.cliente,
      workerId: pedido.worker._id || pedido.worker,
      montoTotal: pedido.total_estimado,
      montoWorker: pedido.pago_worker,
      comisionPlataforma: pedido.total_estimado - pedido.pago_worker,
      zona: pedido.zona,
      rubro: pedido.tipoServicio,
      fechaTrabajo: pedido.fechaRealizacion || new Date()
    });
    
    await transaccion.save();
    console.log('[FINANZAS] Registrada: $' + transaccion.comisionPlataforma + ' | Zona: ' + transaccion.zona);
    
    return transaccion;
    
  } catch (error) {
    console.error('[FINANZAS] Error:', error.message);
    return null;
  }
}

// Dashboard: Rentabilidad por zona (últimas 24h, 7d, 30d)
async function getRentabilidadPorZona(dias = 7) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  
  return await Transaccion.aggregate([
    { $match: { fechaTrabajo: { $gte: desde } } },
    {
      $group: {
        _id: '$zona',
        totalTrabajos: { $sum: 1 },
        ingresoTotal: { $sum: '$montoTotal' },
        comisionTotal: { $sum: '$comisionPlataforma' },
        pagadoWorkers: { $sum: '$montoWorker' },
        promedioComision: { $avg: '$comisionPlataforma' }
      }
    },
    { $sort: { comisionTotal: -1 } }
  ]);
}

// Dashboard: Métricas en tiempo real
async function getMetricasLive() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const [hoyStats, pendientes, topZonas] = await Promise.all([
    // Hoy
    Transaccion.aggregate([
      { $match: { fechaTrabajo: { $gte: hoy } } },
      {
        $group: {
          _id: null,
          trabajos: { $sum: 1 },
          comisionHoy: { $sum: '$comisionPlataforma' }
        }
      }
    ]),
    
    // Pendientes de pago a workers
    Transaccion.countDocuments({ estadoWorker: 'PENDIENTE' }),
    
    // Top 5 zonas del mes
    Transaccion.aggregate([
      {
        $match: {
          fechaTrabajo: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$zona',
          comisionMes: { $sum: '$comisionPlataforma' }
        }
      },
      { $sort: { comisionMes: -1 } },
      { $limit: 5 }
    ])
  ]);
  
  return {
    hoy: hoyStats[0] || { trabajos: 0, comisionHoy: 0 },
    pendientesPago: pendientes,
    topZonas
  };
}

module.exports = {
  registrarTransaccion,
  getRentabilidadPorZona,
  getMetricasLive
};
