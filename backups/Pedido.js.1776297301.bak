const mongoose = require('mongoose');

const PedidoSchema = new mongoose.Schema({
  clienteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  trabajadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  tipoServicio: { type: String, required: true },
  descripcion:  { type: String },
  direccion:    { type: String },
  precio:       { type: Number, default: 0 },
  estado:       { type: String, enum: ['PENDIENTE','SEARCHING','EXPANDING_RADIUS','ACEPTADA','EN_PROCESO','REALIZADA','PAGADA','CANCELADA'], default: 'PENDIENTE' },
  zona: { type: String },
  workersNotificados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  pagoId:       { type: String },
  pagoMonto:    { type: Number },
  pagoComision: { type: Number },
  pagoWorker:   { type: Number },
  ubicacion: {
    lat: Number,
    lng: Number,
  },
}, { timestamps: true });

module.exports = mongoose.model('Pedido', PedidoSchema);
