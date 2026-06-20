'use strict';
const mongoose = require('mongoose');

/**
 * IdempotencyRecord.js — Idempotency Registry (RFC-SYNC-001B)
 * Garantiza que reenviar el mismo commandId nunca produzca un efecto duplicado.
 */

const IdempotencyRecordSchema = new mongoose.Schema({
  commandId: { type: String, required: true, unique: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  deviceId: { type: String, required: true },
  clientSequence: { type: Number, required: true },
  commandType: { type: String, required: true },
  status: { type: String, required: true, enum: ['processed', 'rejected'] },
  eventId: { type: mongoose.Schema.Types.ObjectId, default: null },
  rejectionReason: { type: String, default: null },
  processedAt: { type: Date, default: Date.now }
});

// Garantia constitucional: jamas dos registros con el mismo commandId.
IdempotencyRecordSchema.index({ commandId: 1 }, { unique: true });

// Resolver "ultimo clientSequence procesado" por (actorId, deviceId).
IdempotencyRecordSchema.index({ actorId: 1, deviceId: 1, clientSequence: -1 });

module.exports = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', IdempotencyRecordSchema);
