const mongoose = require('mongoose');

const PrecioMercadoSchema = new mongoose.Schema({
  rubro:    { type: String, required: true, unique: true },
  baja:     { type: Number, required: true },
  alta:     { type: Number, required: true },
  fuente:   { type: String, default: 'groq-estimacion' },
  confidence: { type: Number, default: 0.5 },
  unidad:   { type: String, default: 'hora' },
  actualizadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrecioMercado', PrecioMercadoSchema);
