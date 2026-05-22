// Lead Lifecycle Engine — ServiRed
// Nunca se borra un lead, solo muta estado
const mongoose = require('mongoose');

const LeadEventSchema = new mongoose.Schema({
  estado: String,
  timestamp: { type: Date, default: Date.now },
  actor: String, // 'sistema' | 'admin' | 'trabajador'
  nota: String
}, { _id: false });

const LeadSchema = new mongoose.Schema({
  // Identidad
  nombre:     { type: String, required: true },
  telefono:   { type: String },
  email:      { type: String },
  zona:       { type: String },
  rubro:      { type: String }, // normalizado a rubros.js IDs

  // Origen
  source:     { type: String, enum: ['manual','facebook','olx','whatsapp','referido','telegram','otro'], default: 'manual' },
  source_url: { type: String },
  source_raw: { type: String }, // texto original antes de normalizar

  // Estado actual
  estado: {
    type: String,
    enum: ['DETECTED','QUEUED','CONTACT_PREPARED','CONTACTED','RESPONDED','REGISTERED','VERIFIED','ACTIVATED','ACTIVE','DESCARTADO'],
    default: 'DETECTED'
  },

  // Scoring Briones (0-100)
  score: { type: Number, default: 0 },

  // Historial de eventos — nunca se borra
  eventos: [LeadEventSchema],

  // Metadata
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }, // cuando se registra
  notas:     { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware: loguear cambio de estado automaticamente
LeadSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Metodo para mutar estado con trazabilidad
LeadSchema.methods.mutarEstado = async function(nuevoEstado, actor = 'sistema', nota = '') {
  this.estado = nuevoEstado;
  this.eventos.push({ estado: nuevoEstado, actor, nota, timestamp: new Date() });
  await this.save();
  console.log('[LeadEngine] Lead', this.nombre, '->', nuevoEstado, '|', actor);
  return this;
};

module.exports = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
