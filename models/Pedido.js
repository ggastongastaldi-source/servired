const mongoose = require('mongoose');

const PedidoSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  
  tipoServicio: { type: String, required: true }, // plomeria, domestica, etc.
  zona: { type: String, required: true }, // palermo, belgrano, etc.
  descripcion: String,
  direccion: String,
  complejidad: { type: String, enum: ['baja', 'media', 'alta'], default: 'baja' },
  
  // Precios
  precio: { type: Number, default: 0 },
  total_estimado: { type: Number, default: 0 },
  pago_worker: { type: Number, default: 0 },
  
  // Estados: PENDIENTE → SEARCHING → EXPANDING_RADIUS → ACEPTADA → EN_PROCESO → REALIZADA
  estado: { 
    type: String, 
    enum: ['PENDIENTE', 'SEARCHING', 'EXPANDING_RADIUS', 'ACEPTADA', 'EN_PROCESO', 'REALIZADA', 'PAGADA', 'CANCELADA'], 
    default: 'PENDIENTE' 
  },
  
  // Tracking de notificaciones
  workersNotificados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  workerAcepto: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  fechaAceptacion: Date,
  
  ubicacion: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  
  fechaCreacion: { type: Date, default: Date.now },
  historialEstados: [{
    estado: String,
    fecha: { type: Date, default: Date.now },
    nota: String
  }]
});

PedidoSchema.index({ estado: 1, tipoServicio: 1, zona: 1 });
PedidoSchema.index({ ubicacion: '2dsphere' });

module.exports = mongoose.model('Pedido', PedidoSchema);
