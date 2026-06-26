/**
 * MerchantProjection — Read Model persistido
 * Nunca se escribe directamente desde controllers.
 * Solo el MerchantProjectionReactor puede escribir aquí.
 * El dashboard lee únicamente este documento.
 */
const mongoose = require('mongoose');

const MerchantProjectionSchema = new mongoose.Schema({
  // Identidad
  merchantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true, unique: true, index: true },
  usuarioId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nombreComercial: String,
  estado:          String,
  verificado:      Boolean,
  logo:            String,
  zonaId:          String,
  rubroId:         String,

  // ── Sub-proyección: Dashboard ────────────────────────────────────────────
  dashboard: {
    vistasHoy:           { type: Number, default: 0 },
    vistasUltimos7dias:  { type: Number, default: 0 },
    vistasUltimos30dias: { type: Number, default: 0 },
    solicitudesHoy:      { type: Number, default: 0 },
    pedidosConcretados:  { type: Number, default: 0 },
    calificacionPromedio:{ type: Number, default: 0 },
    ingresosEstimadoMes: { type: Number, default: 0 },
    boostActivos:        { type: Number, default: 0 }
  },

  // ── Sub-proyección: Catálogo ─────────────────────────────────────────────
  catalogo: {
    totalItems:    { type: Number, default: 0 },
    enPromocion:   { type: Number, default: 0 },
    sinStock:      { type: Number, default: 0 },
    topProductos:  { type: Array,  default: [] }  // [{ id, nombre, vistas, precio }]
  },

  // ── Sub-proyección: Analytics ────────────────────────────────────────────
  analytics: {
    conversionRate:           { type: Number, default: 0 },
    vistasUltimos7diasSerie:  { type: Array,  default: [] }, // [{ fecha, cantidad }]
    solicitudesUltimos7diasSerie: { type: Array, default: [] }
  },

  // ── Sub-proyección: Campañas ─────────────────────────────────────────────
  campanias: {
    activas:         { type: Number, default: 0 },
    vistasGeneradas: { type: Number, default: 0 },
    conversionRate:  { type: Number, default: 0 }
  },

  // ── Control de reconstrucción ────────────────────────────────────────────
  ultimoEventoProcesado: { type: String, default: null },  // hash del último evento
  version:               { type: Number, default: 0 },     // para optimistic locking
  reconstruidaEn:        { type: Date,   default: Date.now },
  actualizadaEn:         { type: Date,   default: Date.now }
}, {
  collection: 'merchant_projections',
  timestamps: { createdAt: 'reconstruidaEn', updatedAt: 'actualizadaEn' }
});

MerchantProjectionSchema.index({ zonaId: 1 });
MerchantProjectionSchema.index({ rubroId: 1 });

module.exports = mongoose.model('MerchantProjection', MerchantProjectionSchema);
