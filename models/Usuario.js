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
  ubicacion:    { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [] } },
  telefono:     { type: String, default: '' },
  direccion:    { type: String, default: '' },
  calificacion: { type: Number, default: 0 },
  totalTrabajos:{ type: Number, default: 0 },
  verificado:   { type: Boolean, default: false },
  fcmToken:     { type: String, default: null },
}, { timestamps: true });

usuarioSchema.index({ ubicacion: '2dsphere' });

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);
