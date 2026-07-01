// IncidentCase.js — Capa 3: Correlación (Fiscal)
// Agrupa uno o más PolicyFinding en un caso diagnosticable.
// El Fiscal escribe acá. El Police (dixieScanner) nunca escribe acá.
// Este archivo define SOLO el modelo — el agregador que lo llena
// se implementa en un bloque posterior, deliberadamente separado.

const mongoose = require('mongoose');

const TimelineEntrySchema = new mongoose.Schema({
  at:     { type: Date, default: Date.now },
  action: {
    type: String,
    enum: ['CREATED', 'FINDING_ADDED', 'ESCALATED', 'RUNBOOK_ATTEMPTED', 'RUNBOOK_SUCCEEDED', 'RUNBOOK_FAILED', 'RESOLVED', 'REOPENED', 'MARKED_FALSE_POSITIVE'],
    required: true
  },
  detail: { type: mongoose.Schema.Types.Mixed },
  actor:  { type: String, default: 'system:fiscal' } // 'system:fiscal' | 'system:defensor' | userId del Juez humano
}, { _id: false });

const IncidentCaseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true }, // determinístico o uuid — decidido al implementar el agregador

  // ── Correlación — nunca duplica evidencia, solo referencia ──
  findingIds: [{ type: String, required: true }], // → PolicyFinding.findingId

  // ── Diagnóstico consolidado (lo completa el Fiscal) ──
  severity:      { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  confidence:    { type: Number, min: 0, max: 1, default: null },
  probableCause: { type: String, default: null },
  affectedService: { type: String, default: null }, // ej. 'mongodb', 'google-oauth', 'mercadopago', 'sinapsis_bus_log'
  impact:        { type: String, default: null },   // descripción libre del impacto observado
  priority:      { type: String, enum: ['P1', 'P2', 'P3', 'P4'], default: null },

  // ── Estado (FSM) ──
  status: {
    type: String,
    enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'],
    default: 'OPEN'
  },

  // ── Acciones del Defensor (Capa 4, se llena en bloque posterior) ──
  runbooksAttempted: [{
    runbookId:  { type: String },
    attemptedAt: { type: Date },
    result:     { type: String, enum: ['SUCCESS', 'FAILURE', 'PARTIAL'] },
    detail:     { type: mongoose.Schema.Types.Mixed }
  }],

  // ── Resolución — insumo directo para Jurisprudencia (Capa 5) ──
  resolution: {
    resolvedAt:  { type: Date },
    resolvedBy:  { type: String }, // 'runbook:<id>' | 'human:<userId>' | null
    summary:     { type: String },
    mttrMs:      { type: Number }  // detectedAt → resolvedAt, calculado al resolver
  },

  // ── Auditoría propia del caso ──
  timeline: [TimelineEntrySchema],

  detectedAt: { type: Date, required: true }, // timestamp del primer finding agrupado
  updatedAt:  { type: Date, default: Date.now }
}, {
  collection: 'incident_cases'
});

IncidentCaseSchema.index({ status: 1, detectedAt: -1 });
IncidentCaseSchema.index({ severity: 1, status: 1 });
IncidentCaseSchema.index({ affectedService: 1 });

const IncidentCase = mongoose.models.IncidentCase ||
  mongoose.model('IncidentCase', IncidentCaseSchema);

module.exports = { IncidentCase };
