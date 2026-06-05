// models/TemporalAssuranceState.js
// Estado temporal del compromiso — vive SEPARADO del modelo Pedido comercial

const mongoose = require('mongoose');

const CheckpointSchema = new mongoose.Schema({
  type:        { type: String, enum: ['NIGHT_PACT', 'TWO_HOUR_GATE', 'FINAL_CONFIRM'] },
  scheduledAt: Date,
  resolvedAt:  Date,
  resolution:  { type: String, enum: ['CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'TIMEOUT', 'PENDING'], default: 'PENDING' }
}, { _id: false });

const TemporalAssuranceStateSchema = new mongoose.Schema({
  pedidoId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', required: true, unique: true },
  clienteId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  workerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },

  // Física del turno
  archetype:   { type: String, enum: ['REALTIME_CRITICAL', 'HYBRID_TEMPORAL', 'PROGRAMMABLE', 'PROJECT_LONG_TERM'], required: true },
  serviceMode: { type: String, enum: ['URGENT', 'SCHEDULED', 'PROJECT', 'RECURRING'], required: true },
  scheduledFor: Date,  // Cuándo es el turno

  // Estado del pacto
  pactState: {
    type: String,
    enum: [
      'NOT_REQUIRED',             // REALTIME_CRITICAL no necesita pacto
      'AWAITING_NIGHT_PACT',      // Esperando confirmación nocturna (20:00 noche anterior)
      'NIGHT_PACT_CONFIRMED',     // Cliente confirmó
      'AWAITING_TWO_HOUR_GATE',   // Esperando checkpoint T-2h
      'AUTHORIZED_TO_DEPART',     // Worker puede salir
      'WORKER_HOLD',              // Worker en espera por silencio del cliente
      'AUTO_REASSIGNMENT_PENDING',// Cancelación crítica, reasignando
      'BROKEN'                    // Pacto roto definitivo
    ],
    default: 'AWAITING_NIGHT_PACT'
  },

  checkpoints: [CheckpointSchema],

  // Consecuencias
  frictionApplied: { type: Boolean, default: false },
  frictionAmountARS: { type: Number, default: 0 },
  frictionActor: { type: String, enum: ['CLIENTE', 'WORKER', 'NONE'], default: 'NONE' },
  reputationDelta: { type: Number, default: 0 },

  // Metadatos
  cancelledBy:  { type: String, enum: ['CLIENTE', 'WORKER', 'SISTEMA'] },
  cancelReason: String,
  resolvedAt:   Date,
  schemaVersion: { type: Number, default: 1 }

}, { timestamps: true });

TemporalAssuranceStateSchema.index({ workerId: 1, pactState: 1 });
TemporalAssuranceStateSchema.index({ scheduledFor: 1, pactState: 1 }); // Para crons nocturnos

module.exports = mongoose.model('TemporalAssuranceState', TemporalAssuranceStateSchema);
