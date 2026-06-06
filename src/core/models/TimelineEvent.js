const mongoose = require('mongoose');

const TimelineEventSchema = new mongoose.Schema({
  pedidoId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', required: true, index: true },
  tipo:      { 
    type: String, 
    enum: ['EMITIDO','BUSCANDO','ACEPTADO','EN_CAMINO','EN_PROCESO',
           'REALIZADO','PAGADO','CANCELADO','CONFIRMACION_24H','CONFIRMACION_2H',
           'MENSAJE_CLIENTE','MENSAJE_WORKER','SISTEMA'],
    required: true 
  },
  actor:     { type: String, enum: ['cliente','worker','sistema'], default: 'sistema' },
  mensaje:   { type: String, default: '' },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
  rtgRegime: { type: String, default: null }, // régimen RTG al momento del evento
  ts:        { type: Date, default: Date.now },
}, { timestamps: false });

TimelineEventSchema.index({ pedidoId: 1, ts: 1 });

module.exports = mongoose.model('TimelineEvent', TimelineEventSchema);
