const mongoose = require('mongoose');

const CatalogItemSchema = new mongoose.Schema({
  merchantId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true, index: true },
  usuarioId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },

  // Identidad
  nombre:       { type: String, required: true, trim: true },
  descripcion:  { type: String, trim: true, maxlength: 1000 },
  sku:          { type: String, trim: true },

  // Economía (centavo-scale, compatible con Aladín/BigMac)
  precioARS:    { type: Number, required: true, min: 0 },
  precioBMI:    { type: Number },           // normalizado Big Mac Index
  moneda:       { type: String, default: 'ARS' },

  // Categorización (reutiliza rubros del catálogo ontológico)
  rubroId:      { type: String, required: true, index: true },
  categoria:    { type: String },
  tags:         [String],

  // Inventario
  stock:        { type: Number, default: null },  // null = sin control de stock
  disponible:   { type: Boolean, default: true, index: true },

  // Visual
  imagenes:     [String],   // URLs
  imagenPrincipal: String,

  // Promoción
  enPromocion:  { type: Boolean, default: false },
  precioPromo:  { type: Number },
  promoHasta:   { type: Date },

  // Estado
  estado:       { type: String, enum: ['ACTIVO','PAUSADO','BORRADOR'], default: 'ACTIVO', index: true },

  // Métricas (actualizadas por projection)
  metricas: {
    vistas:     { type: Number, default: 0 },
    consultas:  { type: Number, default: 0 },
    ventas:     { type: Number, default: 0 }
  },

  creadoEn:     { type: Date, default: Date.now },
  actualizadoEn:{ type: Date, default: Date.now }
}, {
  collection: 'catalog_items',
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }
});

CatalogItemSchema.index({ merchantId: 1, estado: 1 });
CatalogItemSchema.index({ merchantId: 1, rubroId: 1 });

module.exports = mongoose.model('CatalogItem', CatalogItemSchema);
