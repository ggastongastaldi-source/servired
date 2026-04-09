const mongoose = require('mongoose');
const usuarioSchema = new mongoose.Schema({
  nombre: String,
  email: { type: String, unique: true },
  password: String,
  rol: { type: String, enum: ['CLIENTE','TRABAJADOR','ADMIN'], default: 'CLIENTE' },
  estado: { type: String, default: 'ACTIVO' },
  especialidades: [String],
  telefono: String
}, { timestamps: true });
module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
