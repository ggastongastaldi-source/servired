const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const giaConversationSchema = new mongoose.Schema({
  comercioId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', required: true },
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  mensajes:        { type: [mensajeSchema], default: [] },
  ultimaActividad: { type: Date, default: Date.now }
}, { timestamps: true });

giaConversationSchema.index({ comercioId: 1, userId: 1 }, { unique: true });
giaConversationSchema.index({ ultimaActividad: -1 });

// Mantener máximo 100 mensajes por conversación (ventana deslizante)
giaConversationSchema.pre('findOneAndUpdate', function() {
  if (this.getUpdate().$push?.mensajes) {
    this.getUpdate().$push.mensajes.$slice = -100;
  }
});

module.exports = mongoose.model('GiaConversation', giaConversationSchema);
