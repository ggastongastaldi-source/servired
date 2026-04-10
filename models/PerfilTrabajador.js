const mongoose = require('mongoose');

const perfilSchema = new mongoose.Schema({
  nombre:              String,
  email:               { type: String, unique: true },
  especialidades:      [String],
  estado:              { type: String, default: 'ACTIVO' },
  verificado:          { type: Boolean, default: false },
  bio:                 String,
  tarifaHora:          Number,
  trabajosCompletados: { type: Number, default: 0 },
  rating:              { type: Number, default: 0 },
  ultimaActividad:     Date,
  ubicacion: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number],
  },
}, { timestamps: true });

perfilSchema.index({ ubicacion: '2dsphere' });

module.exports = mongoose.model('PerfilTrabajador', perfilSchema, 'perfilestrabajadores');
