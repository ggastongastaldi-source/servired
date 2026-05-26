// Engine Config — lee configuracion desde MongoDB
// pricingMultiplier SIEMPRE 1.0 en produccion (Shadow Mode)
const mongoose = require('mongoose');

const EngineConfigSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  value:     { type: mongoose.Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now }
}, { suppressReservedKeysWarning: true, collection: 'engine_config' });

const EngineConfig = mongoose.models.EngineConfig ||
  mongoose.model('EngineConfig', EngineConfigSchema);

async function getConfig(key, defaultVal) {
  try {
    const doc = await EngineConfig.findOne({ key }).lean();
    return doc ? doc.value : defaultVal;
  } catch(e) {
    console.error('[EngineConfig] Error leyendo', key, ':', e.message);
    return defaultVal;
  }
}

async function setConfig(key, value) {
  await EngineConfig.findOneAndUpdate(
    { key },
    { value, updatedAt: new Date() },
    { upsert: true }
  );
}

module.exports = { getConfig, setConfig, EngineConfig };
