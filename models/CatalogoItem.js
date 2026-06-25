const mongoose = require('mongoose');

const CatalogoItemSchema = new mongoose.Schema({
  // Identidad
  productId:      { type: String, required: true, unique: true },
  commerceId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Commerce' },
  fuente:         { type: String, default: 'manual' }, // 'manual' | 'planilla' | 'seed'
  fuenteNombre:   { type: String }, // ej: "Capri Materiales"
  fuenteFecha:    { type: String }, // ej: "Abril 2026"

  // Semántica
  nombre:         { type: String, required: true },
  categoria:      { type: String, required: true }, // 'tabique' | 'cielorraso' | 'revestimiento'
  subcategoria:   { type: String },
  marca:          { type: String },
  aplicaciones:   [{ type: String }], // ['construccion_seca', 'durlock', 'reforma']

  // Precio operativo
  unidad:         { type: String, default: 'm2' },
  precioMaterial: { type: Number }, // ARS sin IVA
  precioManoObra: { type: Number }, // ARS + IVA
  precioTotal:    { type: Number }, // calculado

  // Calibración económica (Big Mac Index)
  bigMacRef:      { type: Number }, // precio Big Mac ARS al momento de carga
  bmMaterial:     { type: Number }, // precioMaterial / bigMacRef
  bmManoObra:     { type: Number }, // precioManoObra / bigMacRef
  bmTotal:        { type: Number }, // precioTotal / bigMacRef

  // Operativo
  activo:         { type: Boolean, default: true },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now }
});

// Calcular ratios Big Mac automáticamente antes de guardar
CatalogoItemSchema.pre('save', async function() {
  if (this.precioMaterial && this.precioManoObra) {
    this.precioTotal = this.precioMaterial + this.precioManoObra;
  }
  if (this.bigMacRef && this.bigMacRef > 0) {
    if (this.precioMaterial) this.bmMaterial  = parseFloat((this.precioMaterial / this.bigMacRef).toFixed(3));
    if (this.precioManoObra) this.bmManoObra  = parseFloat((this.precioManoObra / this.bigMacRef).toFixed(3));
    if (this.precioTotal)    this.bmTotal     = parseFloat((this.precioTotal    / this.bigMacRef).toFixed(3));
  }
  this.updatedAt = new Date();
});

module.exports = mongoose.model('CatalogoItem', CatalogoItemSchema);
