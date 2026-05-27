const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre:       { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  roles:        { type: [String], enum: ['CLIENTE', 'TRABAJADOR', 'ADMIN'], default: ['CLIENTE'] },
  // legacy - mantener para compatibilidad
  rol:          { type: String, enum: ['CLIENTE', 'TRABAJADOR', 'WORKER', 'ADMIN'], default: 'CLIENTE' },
  estado:       { type: String, enum: ['ACTIVO', 'INACTIVO', 'PENDIENTE_VERIFICACION'], default: 'ACTIVO' },
  disponible:   { type: Boolean, default: false },
  isOnline:     { type: Boolean, default: false },
  especialidades: [String],
  rubro:        { type: String, default: null },
  ubicacion:    { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], index: false, default: [-58.3816, -34.6037] } },
  telefono:     { type: String, default: '' },
  direccion:    { type: String, default: '' },
  calificacion: { type: Number, default: 0 },

  // ── REPUTACIÓN CONDUCTUAL ─────────────────────────────────
  reliabilityScore: { type: Number, default: 100 },   // 0-100, arranca en 100
  trustTier: {
    type: String,
    enum: ['ELITE','ORO','PLATA','BRONCE','RESTRINGIDO'],
    default: 'PLATA'
  },
  conductualHistory: {
    nightPactsConfirmed:   { type: Number, default: 0 },
    nightPactsBroken:      { type: Number, default: 0 },
    lateCancellations:     { type: Number, default: 0 },
    criticalCancellations: { type: Number, default: 0 },
    noShows:               { type: Number, default: 0 },
    totalJobs:             { type: Number, default: 0 }
  },
  totalTrabajos:{ type: Number, default: 0 },
  // MERITOCRACIA
  puntuacionTotal:  { type: Number, default: 0 },
  cantidadVotos:    { type: Number, default: 0 },
  promedioEstrellas:{ type: Number, default: 0, min: 0, max: 5 },
  nivelMerito:      { type: String, enum: ['BRONCE','PLATA','ORO','ELITE'], default: 'BRONCE' },
  alertaRevision:   { type: Boolean, default: false },
  verificado:   { type: Boolean, default: false },
  fcmToken:     { type: String, default: null },
}, { timestamps: true });

// 2dsphere index manejado manualmente en DB

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);
