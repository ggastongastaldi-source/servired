const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre:       { type: String, required: true },
  email:        { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:     { type: String, default: null },
  googleId:     { type: String, default: null, index: true },
  avatar:       { type: String, default: null },
  provider:     { type: String, enum: ['local','google'], default: 'local' },
  emailVerified:{ type: Boolean, default: false },
  roles:        { type: [String], enum: ['CLIENTE', 'TRABAJADOR', 'ADMIN', 'COMERCIO'], default: ['CLIENTE'] },
  // legacy - mantener para compatibilidad
  rol:          { type: String, enum: ['CLIENTE', 'TRABAJADOR', 'WORKER', 'ADMIN', 'COMERCIO'], default: 'CLIENTE' },

  // ── CAPABILITIES ─────────────────────────────────────────────────────────
  // Permisos derivados del actor, independientes del rol.
  // Un Trabajador con PuedeVender puede operar como comercio sin cambiar de rol.
  // Una Empresa con PuedeCentralizar puede gestionar múltiples sucursales.
  // Catálogo canónico — no agregar valores sin actualizar este comentario:
  //   PuedeVender          — puede publicar servicios/productos en el marketplace
  //   PuedePresupuestar    — puede emitir presupuestos formales
  //   PuedeContratar       — puede contratar Trabajadores en nombre del actor
  //   PuedeCentralizar     — puede gestionar sucursales o sub-actores (PyME/Empresa)
  //   PuedeFinanciar       — puede ofrecer financiamiento a Clientes (requiere aprobación)
  //   PuedeAccederCredito  — habilitado para líneas de crédito basadas en historial
  capabilities: {
    type: [String],
    enum: [
      'PuedeVender',
      'PuedePresupuestar',
      'PuedeContratar',
      'PuedeCentralizar',
      'PuedeFinanciar',
      'PuedeAccederCredito'
    ],
    default: []
  },
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

  // ── PROVIDER ACTIVATION FSM ──────────────────────────────
  onboardingStep:   { type: String, default: null },
  providerState:    { type: String, enum: ["NONE","ONBOARDING","ACTIVE_PROVIDER","SUSPENDED"], default: "NONE" },
  providerCategory: { type: String, default: null },
  serviceZone:      { type: String, default: null },

  // ── WALLET TRABAJADOR ───────────────────────────────────────────────
  wallet_pending:   { type: Number, default: 0 }, // fondos capturados, pendientes de liberacion
  wallet_available: { type: Number, default: 0 }, // fondos disponibles para retiro

  // ── WALLET COMERCIO ──────────────────────────────────────────────────────
  // Mismo modelo semántico que el wallet del Trabajador.
  // Solo se modifican via financeEngine — nunca directamente desde controllers.
  commerce_wallet_pending:   { type: Number, default: 0 },
  commerce_wallet_available: { type: Number, default: 0 },
  client_origin_ref: { type: String, default: null },
  worker_origin_ref: { type: String, default: null },
}, { timestamps: true });

// 2dsphere index manejado manualmente en DB

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);
