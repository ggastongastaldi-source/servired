const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const FinancialIncidentSchema = new mongoose.Schema({
  incident_id:       { type: String, default: () => uuidv4() },
  incident_key:      { type: String, required: true },
  transaction_id:    { type: String, required: true },
  issue:             { type: String, required: true },
  balance:           { type: Number, default: null },
  severity:          { type: String, enum: ['INFO','WARNING','CRITICAL'], required: true },
  first_detected_at: { type: Date, default: Date.now },
  last_detected_at:  { type: Date, default: Date.now },
  occurrences:       { type: Number, default: 1 },
  status:            { type: String, enum: ['OPEN','RESOLVED'], default: 'OPEN' },
  resolved_at:       { type: Date, default: null },
}, { timestamps: false });

// incident_key NO es unique global — un incidente resuelto que reaparece crea nuevo registro
FinancialIncidentSchema.index({ status: 1 });
FinancialIncidentSchema.index({ severity: 1 });
FinancialIncidentSchema.index({ transaction_id: 1 });

module.exports = mongoose.models.FinancialIncident ||
  mongoose.model('FinancialIncident', FinancialIncidentSchema, 'financial_incidents');
