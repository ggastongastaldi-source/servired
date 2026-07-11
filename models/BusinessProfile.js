'use strict';
/**
 * BusinessProfile — extensión del modelo Commerce existente.
 *
 * Commerce (src/core/models/Commerce.js) tiene:
 *   nombre, email, telefono, rubro, direccion, localidad,
 *   zona, qr_code, active, verificado, is_boosted, boost_*
 *
 * BusinessProfile agrega:
 *   usuarioId      — vínculo con el usuario autenticado
 *   commerceId     — referencia al Commerce base (opcional)
 *   razonSocial    — datos legales
 *   cuit
 *   geo            — coordenadas del local principal
 *   horarios       — apertura/cierre por día
 *   logo, banner, galeria
 *   whatsapp, website, instagram
 *   estado         — ciclo de vida del perfil merchant
 *   metricas       — actualizadas por MerchantProjectionReactor
 *
 * Estrategia: si el usuarioId ya tiene un Commerce registrado,
 * commerceId lo vincula. Si no, BusinessProfile es autónomo.
 * En ningún caso se duplican nombre/rubro/direccion del Commerce.
 */
const mongoose = require('mongoose');

const HorarioSchema = new mongoose.Schema({
  dia:      { type: Number, min: 0, max: 6 }, // 0=Dom
  apertura: String,
  cierre:   String,
  cerrado:  { type: Boolean, default: false }
}, { _id: false });

const BusinessProfileSchema = new mongoose.Schema({
  // ── Vínculo con usuario y Commerce existente ────────────────────────────
  usuarioId:  {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true,
    index: true
  },
  commerceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commerce',
    default: null,
    index: true
  },

  // ── Jerarquía para PyME/Empresa multi-sucursal (T-602) ──────────────────
  // parentProfileId: apunta al BusinessProfile raíz (casa matriz).
  // null = perfil raíz (comportamiento por defecto, sin cambio para actores existentes).
  // Un perfil con parentProfileId es una sucursal — hereda rubroId del padre
  // salvo que lo sobreescriba explícitamente.
  // El actor con PuedeCentralizar puede crear y administrar perfiles hijo.
  parentProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessProfile',
    default: null,
    index: true
  },

  // ── Datos del negocio (complementan Commerce, no duplican) ─────────────
  nombreComercial: { type: String, required: true, trim: true },
  razonSocial:     { type: String, trim: true },
  cuit:            { type: String, trim: true, match: /^\d{2}-\d{8}-\d{1}$/ },
  rubroId:         { type: String, required: true, index: true },

  // ── Ubicación principal con geo ─────────────────────────────────────────
  direccion: { type: String, trim: true },
  localidad: { type: String, trim: true },
  zonaId:    { type: String, index: true },
  geo: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },

  // ── Horarios ────────────────────────────────────────────────────────────
  horarios: [HorarioSchema],

  // ── Identidad visual ────────────────────────────────────────────────────
  logo:    { type: String, default: null },
  banner:  { type: String, default: null },
  galeria: [String],

  // ── Contacto digital ────────────────────────────────────────────────────
  whatsapp:  { type: String, trim: true },
  website:   { type: String, trim: true },
  instagram: { type: String, trim: true },

  // ── Estado del perfil ───────────────────────────────────────────────────
  estado: {
    type:    String,
    enum:    ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'],
    default: 'DRAFT',
    index:   true
  },
  verificado:   { type: Boolean, default: false },
  verificadoEn: { type: Date,    default: null },

  // ── Métricas (escritas solo por MerchantProjectionReactor) ─────────────
  metricas: {
    vistasHoy:           { type: Number, default: 0 },
    solicitudesHoy:      { type: Number, default: 0 },
    pedidosConcretados:  { type: Number, default: 0 },
    calificacionPromedio:{ type: Number, default: 0 },
    totalResenas:        { type: Number, default: 0 }
  }
}, {
  collection: 'business_profiles',
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }
});

BusinessProfileSchema.index({ geo: '2dsphere' });
BusinessProfileSchema.index({ zonaId: 1, rubroId: 1 });

module.exports = mongoose.models.BusinessProfile ||
  mongoose.model('BusinessProfile', BusinessProfileSchema);
