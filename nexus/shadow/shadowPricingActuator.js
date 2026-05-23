// Shadow Pricing Actuator v1.0
// REGLA INQUEBRANTABLE: pricingMultiplier real = 1.0 SIEMPRE
// Los calculos dinamicos son SOLO para validacion y aprendizaje
const mongoose   = require('mongoose');
const { getConfig } = require('./engineConfig');

// EMA helper
function ema(prev, current, alpha = 0.3) {
  return prev === null ? current : alpha * current + (1 - alpha) * prev;
}

// Estado en memoria del sensor
const state = {
  emaLatencia:    null,
  emaErrores:     null,
  emaConversion:  null,
  lastRun:        null,
  shadowMultiplier: 1.0
};

async function getSensorData() {
  const now   = new Date();
  const win5m = new Date(now - 300000);
  const win1m = new Date(now - 60000);

  const col = mongoose.connection.collection('events');

  const [
    totalJobs5m,
    completados5m,
    creados1m,
    asignados1m
  ] = await Promise.all([
    col.countDocuments({ entityType: 'job', timestamp: { $gte: win5m } }),
    col.countDocuments({ entityType: 'job', type: 'JOB_COMPLETED', timestamp: { $gte: win5m } }),
    col.countDocuments({ entityType: 'job', type: 'JOB_CREATED',   timestamp: { $gte: win1m } }),
    col.countDocuments({ entityType: 'job', type: 'JOB_ASSIGNED',  timestamp: { $gte: win1m } })
  ]);

  // Conversion: jobs completados / jobs creados en ventana
  const conversionRate = totalJobs5m > 0
    ? (completados5m / totalJobs5m)
    : null;

  // Stress: si hay muchos creados pero pocos asignados
  const assignmentRate = creados1m > 0
    ? (asignados1m / creados1m)
    : null;

  const systemUnderStress = assignmentRate != null && assignmentRate < 0.5 && (creados1m || 0) > 3;

  return { conversionRate, assignmentRate, systemUnderStress, creados1m, asignados1m, totalJobs5m, completados5m };
}

async function runActuator() {
  try {
    const sensor = await getSensorData();

    // EMA sobre conversion
    if (sensor.conversionRate != null) {
      state.emaConversion = ema(state.emaConversion, sensor.conversionRate);
    }

    // Calcular shadow multiplier (NUNCA se aplica al pricing real)
    let shadowMultiplier = 1.0;
    if (sensor.systemUnderStress) {
      shadowMultiplier = Math.max(0.85, 1.0 - (1 - (sensor.assignmentRate || 0.5)) * 0.3);
    } else if (state.emaConversion > 0.7) {
      shadowMultiplier = Math.min(1.2, 1.0 + state.emaConversion * 0.15);
    }

    state.shadowMultiplier = shadowMultiplier;
    state.lastRun = new Date();

    // Conversion Drift — diferencia entre shadow y real (siempre 1.0)
    const conversionDrift = !sensor.conversionRate ? 0 : Math.abs(shadowMultiplier - 1.0);

    // Log en shadow_metrics_log — NUNCA modifica pricing real
    await mongoose.connection.collection('shadow_metrics_log').insertOne({
      timestamp:        new Date(),
      sensor,
      emaConversion:    state.emaConversion,
      shadowMultiplier, // lo que SERIA si estuviera activo
      realMultiplier:   1.0, // SIEMPRE 1.0
      conversionDrift,
      systemUnderStress: sensor.systemUnderStress,
      diagnosis: conversionDrift > 0.1 ? 'SIGNAL' : conversionDrift > 0.05 ? 'INDETERMINADO' : 'NOISE'
    });

    console.log(`[Shadow] 🌑 mult=${shadowMultiplier.toFixed(3)} drift=${conversionDrift.toFixed(3)} stress=${sensor.systemUnderStress} conv=${(sensor.conversionRate||0).toFixed(2)}`);

  } catch(e) {
    console.error('[Shadow-Actuator] Error:', e.message);
  }
}

module.exports = { runActuator, state };
