const ZoneState = require('../../models/ZoneState');
const { changeStreamObserver } = require('./'.replace('//', '/'));

// ── constantes ────────────────────────────────────────────────────────────────
const DECAY_HALF_LIFE_MS = 30 * 60 * 1000; // 30 min
const AMP_MIN = 1, AMP_MAX = 3;
const PRESSURE_SHORTAGE  =  0.2;
const PRESSURE_SURPLUS   = -0.2;

// ── decay exponencial ─────────────────────────────────────────────────────────
function applyDecay(value, lastUpdated) {
  const dt = Date.now() - new Date(lastUpdated).getTime();
  const lambda = Math.LN2 / DECAY_HALF_LIFE_MS;
  return value * Math.exp(-lambda * dt);
}

// ── clamp ─────────────────────────────────────────────────────────────────────
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ── fórmula central ───────────────────────────────────────────────────────────
function computePressure(demand, supply, amplification) {
  const raw = (demand * amplification) - supply;
  return clamp(raw, -1, 1);
}

function deriveZoneState(pressure) {
  if (pressure >  PRESSURE_SHORTAGE) return 'SHORTAGE';
  if (pressure <  PRESSURE_SURPLUS)  return 'SURPLUS';
  return 'BALANCED';
}

// ── deltas por tipo de evento ─────────────────────────────────────────────────
const EVENT_DELTAS = {
  JOB_INTENT_CREATED:      { demand: +0.15, supply:  0,     amplification: 0 },
  JOB_ACCEPTED:            { demand: -0.10, supply: -0.10,  amplification: 0 },
  JOB_COMPLETED:           { demand: -0.05, supply: +0.10,  amplification: 0 },
  WORKER_UPDATED:          { demand:  0,    supply: +0.08,  amplification: 0 },
  QR_SCANNED:              { demand: +0.05, supply:  0,     amplification: +0.05 },
  COMMERCE_BOOST_PURCHASED:{ demand:  0,    supply:  0,     amplification: +0.20 },
};

// ── extrae zoneId desde payload ───────────────────────────────────────────────
function extractZoneId(doc) {
  return doc?.payload?.zona
    || doc?.payload?.zoneId
    || doc?.payload?.zone
    || doc?.zona
    || doc?.zoneId
    || null;
}

// ── procesador principal ──────────────────────────────────────────────────────
async function processEvent(eventType, zoneId, rawPayload = {}) {
  const deltas = EVENT_DELTAS[eventType];
  if (!deltas || !zoneId) return null;

  let zone = await ZoneState.findOne({ zoneId });
  if (!zone) {
    zone = new ZoneState({ zoneId });
  }

  // decay sobre estado previo
  zone.demand        = applyDecay(zone.demand,       zone.lastUpdated);
  zone.supply        = applyDecay(zone.supply,       zone.lastUpdated);
  zone.amplification = applyDecay(zone.amplification - 1, zone.lastUpdated) + 1;

  // aplicar deltas
  zone.demand        = clamp(zone.demand        + deltas.demand,        0, 1);
  zone.supply        = clamp(zone.supply        + deltas.supply,        0, 1);
  zone.amplification = clamp(zone.amplification + deltas.amplification, AMP_MIN, AMP_MAX);

  // recomputar
  zone.marketPressure = computePressure(zone.demand, zone.supply, zone.amplification);
  zone.zoneState      = deriveZoneState(zone.marketPressure);
  zone.eventCount    += 1;
  zone.lastUpdated    = new Date();

  await zone.save();
  return zone.toOutput();
}

// ── replay desde event store ──────────────────────────────────────────────────
async function replayFromEventStore(collection) {
  console.log('[MarketField] iniciando replay desde event store...');
  const cursor = collection.find({}).sort({ timestamp: 1 });
  let count = 0;
  for await (const doc of cursor) {
    const eventType = doc.eventType || doc.tipo;
    const zoneId    = extractZoneId(doc);
    if (eventType && zoneId) {
      await processEvent(eventType, zoneId, doc.payload || {});
      count++;
    }
  }
  console.log('[MarketField] replay completo:', count, 'eventos procesados');
}

// ── subscripción al changeStream ──────────────────────────────────────────────
function startProjection() {
  console.log('[MarketField] proyección iniciada, escuchando changeStream...');

  changeStreamObserver.on('event', async (doc) => {
    try {
      const eventType = doc.eventType || doc.tipo;
      const zoneId    = extractZoneId(doc);
      if (!eventType || !zoneId) return;
      if (!EVENT_DELTAS[eventType]) return;

      const result = await processEvent(eventType, zoneId, doc.payload || {});
      if (result) {
        console.log('[MarketField]', eventType, zoneId, '→ pressure:', result.marketPressure, result.zoneState);
      }
    } catch (err) {
      console.error('[MarketField] error procesando evento:', err.message);
    }
  });
}

module.exports = { startProjection, processEvent, replayFromEventStore };
