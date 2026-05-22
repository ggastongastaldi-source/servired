// DIXIE GATE — Frontera de normalización ServiRed Nexus
// Todo ID pasa por acá o no entra al sistema
const mongoose = require('mongoose');

function toObjectId(value, campo = 'id') {
  if (!value) throw new Error(`[DixieGate] ${campo} es requerido`);
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) throw new Error(`[DixieGate] ${campo} inválido: ${value}`);
  return new mongoose.Types.ObjectId(value);
}

function safeString(value, campo = 'campo', maxLen = 500) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim().slice(0, maxLen);
  return s;
}

function normalizeZona(zona) {
  if (!zona) return 'desconocida';
  return String(zona).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function validatePayload(payload, required = []) {
  const errores = [];
  for (const campo of required) {
    if (!payload[campo]) errores.push(`${campo} es requerido`);
  }
  if (errores.length) throw new Error('[DixieGate] Payload inválido: ' + errores.join(', '));
  return true;
}

// Middleware Express — rechaza IDs malformados temprano
function dixieMiddleware(campos = []) {
  return (req, res, next) => {
    try {
      for (const campo of campos) {
        const val = req.params[campo] || req.body[campo];
        if (val) toObjectId(val, campo);
      }
      next();
    } catch(e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  };
}

module.exports = { toObjectId, safeString, normalizeZona, validatePayload, dixieMiddleware };
