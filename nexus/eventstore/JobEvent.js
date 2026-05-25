// EventStore — job_events
// Append-only. Nunca se modifica, nunca se borra.
const mongoose = require('mongoose');

const JobEventSchema = new mongoose.Schema({
  // Identificación del evento
  eventId:      { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  eventVersion: { type: Number, default: 1 },
  type: {
    type: String,
    required: true,
    enum: ['JOB_CREATED','JOB_POSTULATED','JOB_ASSIGNED','JOB_STARTED','JOB_COMPLETED','JOB_CANCELED','JOB_PAID']
  },

  // Aggregate
  aggregateType: { type: String, default: 'job' },
  aggregateId:   { type: mongoose.Schema.Types.ObjectId, required: true }, // pedidoId

  // Actores
  actorId:   { type: mongoose.Schema.Types.ObjectId },
  actorType: { type: String, enum: ['cliente','trabajador','sistema','admin'] },

  // Trazabilidad
  correlationId: { type: String },
  causationId:   { type: String },
  timestamp:     { type: Date, default: Date.now, index: true },

  // Payload rico — lo que SINAPSIS va a leer
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, {
  collection: 'job_events',
  suppressReservedKeysWarning: true,
  // NUNCA modificar documentos existentes
  strict: false
});

// Indices para SINAPSIS y queries temporales
JobEventSchema.index({ aggregateId: 1, timestamp: 1 });
JobEventSchema.index({ type: 1, timestamp: -1 });
JobEventSchema.index({ actorId: 1, timestamp: -1 });
JobEventSchema.index({ 'payload.zona': 1, timestamp: -1 });
JobEventSchema.index({ 'payload.rubro': 1, timestamp: -1 });

module.exports = mongoose.models.JobEvent || mongoose.model('JobEvent', JobEventSchema);
