const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: String, enum: ['CLIENTE', 'WORKER', 'ADMIN'], default: 'CLIENTE' },
  telefono: String,
  verificado: { type: Boolean, default: false },
  
  // CAMPOS NUEVOS PARA NOTIFICACIONES
  fcmToken: { type: String, default: null },
  isOnline: { type: Boolean, default: false },
  rubro: { type: String, default: null }, // plomeria, domestica, electricidad, etc.
  ubicacion: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [lng, lat]
  },
  
  // Stats
  calificacion: { type: Number, default: 0 },
  totalTrabajos: { type: Number, default: 0 },
  cbu: String,
  
  createdAt: { type: Date, default: Date.now }
});

UsuarioSchema.index({ ubicacion: '2dsphere' });
UsuarioSchema.index({ rubro: 1, isOnline: 1 });

module.exports = mongoose.model('Usuario', UsuarioSchema);
