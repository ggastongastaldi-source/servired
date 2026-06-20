'use strict';
const mongoose = require('mongoose');

/**
 * IdempotencyRecord.js — Idempotency Registry (RFC-SYNC-001B v1.1)
 * Garantiza que reenviar el mismo commandId nunca produzca un efecto duplicado.
 * TTL: 30 dias desde processedAt (ver RFC para justificacion).
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const IdempotencyRecordSchema = new mongoose.Schema({
  commandId: { type: String, required: true, unique: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  deviceId: { type: String, required: true },
  clientSequence: { type: Number, required: true },
  commandType: { type: String, required: true },
  status: { type: String, required: true, enum: ['processed', 'rejected'] },
  eventId: { type: mongoose.Schema.Types.ObjectId, default: null },
  rejectionReason: { type: String, default: null },
  processedAt: { type: Date, default: Date.now },
  expireAt: { type: Date, required: true, default: () => new Date(Date.now() + THIRTY_DAYS_MS) }
});

IdempotencyRecordSchema.index({ commandId: 1 }, { unique: true });
IdempotencyRecordSchema.index({ actorId: 1, deviceId: 1, clientSequence: -1 });
IdempotencyRecordSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', IdempotencyRecordSchema);
