/**
 * Zone Model — ServiRed OS Geomesh v1
 * Solo proyecta métricas territoriales — el catálogo es la fuente de verdad
 * Reemplaza la colección raw proj_zona_metrics
 */
const mongoose = require('mongoose');

const ZoneMetricsSchema = new mongoose.Schema({
  zoneId:       { type: String, required: true, unique: true }, // FK al catálogo
  zoneName:     { type: String, required: true },
  parentZoneId: { type: String, default: null },

  // Métricas de oferta
  workersActivos:   { type: Number, default: 0 },
  commercesActivos: { type: Number, default: 0 },

  // Métricas de demanda
  pedidosUltimas24h:  { type: Number, default: 0 },
  pedidosUltimaSemana:{ type: Number, default: 0 },

  // Métricas económicas
  ticketPromedioARS:  { type: Number, default: 0 },
  revenueUltimaSemanaARS: { type: Number, default: 0 },

  // Métricas de conversión
  tasaConversion:   { type: Number, default: 0 }, // 0.0–1.0
  boostsActivos:    { type: Number, default: 0 },

  // Estado Geomesh
  demandScore:  { type: Number, default: 0 }, // 0–100
  supplyScore:  { type: Number, default: 0 }, // 0–100
  pressureIndex:{ type: Number, default: 0 }, // demandScore - supplyScore

  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'geomesh_zones',
  timestamps: false
});

ZoneMetricsSchema.index({ zoneId: 1 });
ZoneMetricsSchema.index({ demandScore: -1 });
ZoneMetricsSchema.index({ pressureIndex: -1 });

module.exports = mongoose.model('ZoneMetrics', ZoneMetricsSchema);
