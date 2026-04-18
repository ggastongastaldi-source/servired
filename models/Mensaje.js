const mongoose = require('mongoose');
const s = new mongoose.Schema({
  ordenId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Orden', default: null },
  salaId:         { type: String, required: true },
  remitente:      { type: mongoose.Schema.Types.ObjectId, required: true },
  remitenteRol:   { type: String, enum: ['cliente','trabajador','admin'], required: true },
  remitenteNombre:{ type: String, required: true },
  texto:          { type: String, required: true, maxlength: 1000 },
  leido:          { type: Boolean, default: false },
  creadoEn:       { type: Date, default: Date.now }
});
s.index({ salaId: 1, creadoEn: 1 });
module.exports = mongoose.model('Mensaje', s);
