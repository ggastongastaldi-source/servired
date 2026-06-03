const mongoose = require('mongoose');

const TimelineEventSchema = new mongoose.Schema({
  eventId:        { type: String, required: true },
  type:           { type: String, required: true },
  source:         { type: String, required: true },
  at:             { type: Date,   default: Date.now },
  idempotencyKey: { type: String, required: true },
  metadata:       { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const PedidoSchema = new mongoose.Schema({
  cliente:      { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  worker:       { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  tipoServicio: { type: String, required: true },
  zona:         { type: String, required: true },
  descripcion:  String,
  direccion:    String,
  complejidad:  { type: String, enum: ['baja','media','alta'], default: 'baja' },

  // Precios — congelados al momento del checkout, NUNCA recalcular
  precio:          { type: Number, default: 0 },
  total_estimado:  { type: Number, default: 0 },
  pago_worker:     { type: Number, default: 0 },

  // FSM
  estado: {
    type: String,
    enum: ['PENDIENTE','SEARCHING','EXPANDING_RADIUS','ACEPTADA','EN_PROCESO','REALIZADA','CERRADA','CANCELADA'],
    default: 'PENDIENTE'
  },

  // SFS — Financial State (append-only, default-safe)
  linkPago:          { type: String, default: null },
  payment_status:    { type: String, enum: ['PENDING','PAID','HELD','RELEASED','REFUNDED','DISPUTED'], default: 'PENDING' },
  estadoLiquidacion: { type: String, enum: ['UNRESOLVED','LIQUIDATED','DISPUTED'], default: 'UNRESOLVED' }, // deprecated: usar payment_status
  pagoConfirmadoAt:  { type: Date, default: null },

  // Snapshot determinístico
  snapshot: {
    jobStatus:     { type: String, default: 'PENDIENTE' },
    paymentStatus: { type: String, default: 'PENDING' },
    workerStatus:  { type: String, default: 'UNASSIGNED' }
  },

  // Timeline inmutable — append-only
  timeline: [TimelineEventSchema],

  // Historial legible
  historialEstados: [{
    estado: String,
    fecha:  { type: Date, default: Date.now },
    nota:   String
  }],

  // Meritocracia
  calificacionCliente: { type: Number, min: 1, max: 5, default: null },
  calificacionWorker:  { type: Number, min: 1, max: 5, default: null },
  calificadoPor:       [{ type: String }],
  fechaCalificacion:   { type: Date, default: null },

  // Tracking
  workersNotificados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  workerAcepto:       { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  fechaAceptacion:    Date,

  ubicacion: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number]
  },

  serviceMode:  { type: String, enum: ['URGENT','SCHEDULED','PROJECT','RECURRING'], default: 'URGENT' },
  scheduledFor:    { type: Date,    default: null },
  confirmacion24h: { type: Boolean, default: false },
  confirmacion2h:  { type: Boolean, default: false },
  esProgramado:    { type: Boolean, default: false },
  notas:           { type: String,  default: '' },

  fechaCreacion: { type: Date, default: Date.now }
});

// Índices obligatorios
PedidoSchema.index({ estado: 1, tipoServicio: 1, zona: 1 });
PedidoSchema.index({ ubicacion: '2dsphere' });
PedidoSchema.index({ 'timeline.at': 1 });
PedidoSchema.index({ 'timeline.eventId': 1 }, { unique: true, sparse: true });
PedidoSchema.index({ 'timeline.idempotencyKey': 1 }, { sparse: true });
PedidoSchema.index({ 'snapshot.paymentStatus': 1 });

module.exports = mongoose.model('Pedido', PedidoSchema);
