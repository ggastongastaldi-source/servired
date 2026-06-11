const mongoose = require('mongoose');

const ReferidoSchema = new mongoose.Schema({
  ref_code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  nombre:   { type: String, required: true },
  zona:     { type: String, required: true },
  tipo:     { type: String, enum: ['ferreteria','corralon','pintureria','otro'], default: 'otro' },
  activo:   { type: Boolean, default: true },
  stats: {
    scans:     { type: Number, default: 0 },
    registros: { type: Number, default: 0 },
    workers:   { type: Number, default: 0 },
    clientes:  { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'referidos' });

module.exports = mongoose.model('Referido', ReferidoSchema);
