const mongoose = require('mongoose');

const transaccionSchema = new mongoose.Schema({
  // Referencias
  pedidoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', required: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  
  // Montos (ARS)
  montoTotal: { type: Number, required: true },           // Lo que pagó el cliente
  montoWorker: { type: Number, required: true },          // 80% al trabajador
  comisionPlataforma: { type: Number, required: true },   // 20% ServiRed
  
  // Metadata geográfica (para analytics)
  zona: { type: String, required: true },
  rubro: { type: String, required: true },
  
  // Estado de liquidación
  estadoWorker: { 
    type: String, 
    enum: ['PENDIENTE', 'EN_PROCESO', 'PAGADO'], 
    default: 'PENDIENTE' 
  },
  estadoComision: {
    type: String,
    enum: ['PENDIENTE', 'FACTURADA', 'COBRADA'],
    default: 'PENDIENTE'
  },
  
  // Timestamps
  fechaTrabajo: { type: Date, default: Date.now },
  fechaPagoCliente: Date,
  fechaPagoWorker: Date,
  
  // Métricas
  tiempoMinutos: Number,  // Duración del trabajo (GPS start/end)
  
}, { timestamps: true });

// Índices para analytics en tiempo real
transaccionSchema.index({ zona: 1, fechaTrabajo: -1 });
transaccionSchema.index({ rubro: 1, comisionPlataforma: 1 });
transaccionSchema.index({ estadoWorker: 1, fechaTrabajo: 1 });

module.exports = mongoose.model('Transaccion', transaccionSchema);
