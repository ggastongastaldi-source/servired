// PolicyFinding.js — schema de findings de Dixie Gate Terminal
// Colección: dixie_findings — append-only, upsert idempotente por findingId

const mongoose = require('mongoose');

const PolicyFindingSchema = new mongoose.Schema({
  findingId:      { type: String, required: true },   // rule:collection:ref — unique
  rule:           { type: String, required: true },
  severity:       { type: String, enum: ['LOW','MEDIUM','HIGH','CRITICAL'], required: true },
  collection:     { type: String, required: true },   // colección afectada o 'cross'
  detail:         { type: mongoose.Schema.Types.Mixed },
  status:         { type: String, enum: ['OPEN','ACKNOWLEDGED'], default: 'OPEN' },
  detectedAt:     { type: Date, default: Date.now },
  acknowledgedAt: { type: Date }
}, { collection: 'dixie_findings' });

PolicyFindingSchema.index({ findingId: 1 }, { unique: true });
PolicyFindingSchema.index({ status: 1, detectedAt: -1 });
PolicyFindingSchema.index({ rule: 1 });

const PolicyFinding = mongoose.models.PolicyFinding ||
  mongoose.model('PolicyFinding', PolicyFindingSchema);

module.exports = { PolicyFinding };
