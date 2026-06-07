const mongoose = require('mongoose');

/**
 * B19 Policy Engine — PolicyRule Model
 * Reglas versionadas, auditables e inmutables.
 * Nunca se edita un documento: se crea una nueva versión (append-only).
 */

const ConditionSchema = new mongoose.Schema({
  field:    { type: String, required: true },   // ej: 'factor_demanda', 'zona', 'hora'
  operator: { type: String, required: true, enum: ['gt','gte','lt','lte','eq','in','between'] },
  value:    { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });

const ActionSchema = new mongoose.Schema({
  type:    { type: String, required: true, enum: [
    'multiply_price',   // precio × factor
    'cap_price',        // precio ≤ max
    'floor_price',      // precio ≥ min
    'freeze_dispatch',  // bloquea asignación
    'rollback_policy',  // revierte a versión anterior
    'emit_event',       // dispara evento al Event Store
    'adjust_factor',    // modifica factor específico
  ]},
  params:  { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false });

const PolicyRuleSchema = new mongoose.Schema({
  // ── IDENTIDAD
  ruleId:      { type: String, required: true, index: true },  // ej: 'pricing_floor_rule'
  version:     { type: String, required: true },               // semver: '3.2.0'
  description: { type: String, required: true },

  // ── ESTADO
  status: {
    type: String,
    enum: ['active', 'shadow', 'frozen', 'deprecated'],
    default: 'shadow',
    index: true,
  },

  // ── SCOPE
  scope: {
    rubros: [{ type: String }],       // vacío = todos los rubros
    zonas:  [{ type: String }],       // vacío = todas las zonas
    hours:  {                         // ventana horaria aplicable
      from: { type: Number, min: 0, max: 23 },
      to:   { type: Number, min: 0, max: 23 },
    },
  },

  // ── LÓGICA
  conditions: [ConditionSchema],      // AND entre todas
  actions:    { type: [ActionSchema], required: true },
  priority:   { type: Number, default: 100 },  // menor = mayor prioridad

  // ── ROLLBACK
  previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PolicyRule' },
  rollbackable:      { type: Boolean, default: true },

  // ── AUDITORÍA (inmutable tras creación)
  createdBy:  { type: String, required: true },   // userId o 'system'
  activatedAt:{ type: Date },
  deprecatedAt:{ type: Date },
  hash:       { type: String },                   // SHA256 del contenido serializado

}, {
  timestamps: true,
  collection: 'policy_rules',
});

// Índice compuesto: ruleId + version debe ser único
PolicyRuleSchema.index({ ruleId: 1, version: 1 }, { unique: true });

// Índice operativo: status + priority para evaluación en runtime
PolicyRuleSchema.index({ status: 1, priority: 1 });

// Pre-save: calcular hash de contenido para auditoría
PolicyRuleSchema.pre('save', async function() {
  const crypto = require('crypto');
  const content = JSON.stringify({
    ruleId:     this.ruleId,
    version:    this.version,
    conditions: this.conditions,
    actions:    this.actions,
    scope:      this.scope,
  });
  this.hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  
});

module.exports = mongoose.model('PolicyRule', PolicyRuleSchema);
