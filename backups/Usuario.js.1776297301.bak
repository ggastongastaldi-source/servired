const mongoose = require('mongoose');
const usuarioSchema = new mongoose.Schema({
  nombre: String,
  email: { type: String, unique: true },
  password: String,
  rol: { type: String, enum: ['CLIENTE','TRABAJADOR','ADMIN'], default: 'CLIENTE' },
  estado: { type: String, default: 'ACTIVO' },
  especialidades: [String],
  telefono: String,
  dni: String,
  cbu: String,
  alias: String,
  especialidades: [String],
  estado: { type: String, default: 'ACTIVO' },
  verificado: { type: Boolean, default: false },
  bio: String,
  tarifaHora: Number,
  trabajosCompletados: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  disponible: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
