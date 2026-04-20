const mongoose = require('mongoose');

const cotizacionSchema = new mongoose.Schema({
    precioBase: Number,
    precioFinalARS: Number,
    comisionAplicada: Number,
    indiceBigMac: { type: Number, default: 10500 },
    factorAjuste: Number,
    tipoServicio: String,
    rubro: String,
    zona: String,
    status: { 
        type: String, 
        enum: ['pendiente', 'buscando_profesional', 'asignado', 'completado'], 
        default: 'buscando_profesional' 
    },
    clienteId: { type: String, default: null },
    trabajadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Cotizacion', cotizacionSchema);
