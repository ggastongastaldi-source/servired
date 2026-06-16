// SystemState.js — singleton de estado operativo (Sprint 3C-A)
// Colección: system_state — un único documento con _id fijo "global"
// Modo puramente observacional: ningún componente productivo lo consulta todavía.

const mongoose = require('mongoose');

const SystemStateSchema = new mongoose.Schema({
  _id:    { type: String, default: 'global' },
  mode:   { type: String, enum: ['NORMAL', 'DEGRADED'], default: 'NORMAL' },
  reason: { type: String, default: null }
}, { collection: 'system_state', timestamps: true });

const SystemState = mongoose.models.SystemState ||
  mongoose.model('SystemState', SystemStateSchema);

// Helper: obtiene el singleton, creándolo si no existe (lazy init idempotente)
async function getState() {
  let doc = await SystemState.findById('global');
  if (!doc) {
    doc = await SystemState.create({ _id: 'global', mode: 'NORMAL', reason: null });
  }
  return doc;
}

module.exports = { SystemState, getState };
