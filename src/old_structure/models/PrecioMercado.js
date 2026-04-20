const mongoose = require('mongoose');

const PrecioMercadoSchema = new mongoose.Schema({
  rubro:       { type: String, required: true, unique: true },
  baja:        { type: Number, required: true },
  alta:        { type: Number, required: true },
  fuente:      { type: String, default: 'manual' }, // manual | tavily | mercadolibre
  actualizadoEn: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('PrecioMercado', PrecioMercadoSchema);
