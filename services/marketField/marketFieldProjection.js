const ZoneState = require('../../models/ZoneState');

const DECAY_HALF_LIFE_MS    = 30 * 60 * 1000;
const AMP_MIN = 1, AMP_MAX  = 3;
const PRESSURE_SHORTAGE     =  0.2;
const PRESSURE_SURPLUS      = -0.2;

function applyDecay(value, lastUpdated) {
  const dt     = Date.now() - new Date(lastUpdated).getTime();
  const lambda = Math.LN2 / DECAY_HALF_LIFE_MS;
  return value * Math.exp(-lambda * dt);
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function computePressure(demand, supply, amplification) {
  return clamp((demand * amplification) - supply, -1, 1);
}

function deriveZoneState(pressure) {
  if (pressure >  PRESSURE_SHORTAGE) return 'SHORTAGE';
  if (pressure <  PRESSURE_SURPLUS)  return 'SURPLUS';
  return 'BALANCED';
}

async function processEvent(eventType, zoneId, payload = {}, deltas) {
  const d = deltas[eventType];
  if (!d || !zoneId) return null;

  let zone = await ZoneState.findOne({ zoneId });
  if (!zone) zone = new ZoneState({ zoneId });

  // decay sobre estado previo
  zone.demand        = applyDecay(zone.demand,             zone.lastUpdated);
  zone.supply        = applyDecay(zone.supply,             zone.lastUpdated);
  zone.amplification = applyDecay(zone.amplification - 1,  zone.lastUpdated) + 1;

  // aplicar deltas
  zone.demand        = clamp(zone.demand        + d.demand,        0, 1);
  zone.supply        = clamp(zone.supply        + d.supply,        0, 1);
  zone.amplification = clamp(zone.amplification + d.amplification, AMP_MIN, AMP_MAX);

  // recomputar
  zone.marketPressure = computePressure(zone.demand, zone.supply, zone.amplification);
  zone.zoneState      = deriveZoneState(zone.marketPressure);
  zone.eventCount    += 1;
  zone.lastUpdated    = new Date();

  await zone.save();
  return zone.toOutput();
}

// replay desde colección arbitraria — preserva invariante de replay
async function replayFromCollection(collection, deltas) {
  console.log('[MarketField] replay iniciado...');
  const cursor = collection.find({}).sort({ timestamp: 1 });
  let count = 0;
  for await (const doc of cursor) {
    const eventType = doc.type || doc.eventType || doc.tipo;
    const zoneId    = doc.payload?.zona || doc.payload?.zoneId || doc.payload?.zone;
    if (eventType && zoneId && deltas[eventType]) {
      await processEvent(eventType, zoneId, doc.payload || {}, deltas);
      count++;
    }
  }
  console.log('[MarketField] replay completo:', count, 'eventos');
}

module.exports = { processEvent, replayFromCollection };
