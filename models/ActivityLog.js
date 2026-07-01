const mongoose = require('mongoose');

/**
 * FSM de estados:
 * informativo  (terminal — solo lectura)
 * pendiente    → aprobado → ejecutado (terminal)
 *              → aprobado → error     (terminal)
 *              → rechazado            (terminal)
 */
const activityLogSchema = new mongoose.Schema({
  comercioId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true },

  tipo: {
    type: String,
    enum: [
      'venta_realizada', 'gia_recomendacion', 'gia_accion_automatica',
      'gia_requiere_confirmacion', 'reposicion_sugerida', 'precio_actualizado',
      'stock_critico', 'cliente_inactivo', 'pago_recibido', 'pedido_recibido',
      'automatizacion_ejecutada', 'empleado_evento', 'resena_recibida', 'sistema'
    ],
    required: true
  },

  modulo: {
    type: String,
    enum: ['pulse','productos','ventas','clientes','proveedores','mostrador','caja','automatizaciones','sistema'],
    default: 'sistema'
  },

  descripcion: { type: String, required: true },

  actor: {
    tipo:   { type: String, enum: ['gia','comerciante','sistema','cliente','empleado'], default: 'sistema' },
    nombre: { type: String, default: 'Sistema' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
  },

  nivelRiesgo: {
    type: String,
    enum: ['info','propuesta','automatico','requiere_confirmacion'],
    default: 'info'
  },

  // FSM
  estado: {
    type: String,
    enum: ['informativo','pendiente','aprobado','rechazado','ejecutado','error'],
    default: 'informativo'
  },

  // Auditoría de ejecución
  executor:           { type: String },              // qué servicio ejecutó la acción
  resultadoEjecucion: { type: mongoose.Schema.Types.Mixed },
  errorCode:          { type: String },
  errorMessage:       { type: String },

  // Trazabilidad de eventos complejos
  correlationId: { type: String },                  // agrupa eventos de una misma operación (índice declarado abajo)
  parentEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityLog' },

  payload:    { type: mongoose.Schema.Types.Mixed, default: {} },
  accionUrl:  { type: String },
  timestamp:  { type: Date, default: Date.now }

}, { timestamps: true });

activityLogSchema.index({ comercioId: 1, timestamp: -1 });
activityLogSchema.index({ comercioId: 1, estado: 1 });
activityLogSchema.index({ correlationId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
