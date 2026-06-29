const { processEvent } = require('../../services/marketField/marketFieldProjection');
const { checkThresholds } = require('../../services/marketField/marketFieldReactor');

// Eventos de job que tienen impacto territorial
const JOB_DELTAS = {
  JOB_CREATED:   { demand: +0.15, supply:  0,     amplification: 0 },
  JOB_ASSIGNED:  { demand: -0.10, supply: -0.10,  amplification: 0 },
  JOB_STARTED:   { demand: -0.05, supply: -0.08,  amplification: 0 },
  JOB_COMPLETED: { demand: -0.05, supply: +0.10,  amplification: 0 },
  JOB_PAID:      { demand:  0,    supply: +0.05,  amplification: 0 },
};

const MARKET_DELTAS = {
  QR_SCANNED:               { demand: +0.05, supply:  0,    amplification: +0.05 },
  COMMERCE_BOOST_PURCHASED: { demand:  0,    supply:  0,    amplification: +0.20 },
  WORKER_ACTIVATED:         { demand:  0,    supply: +0.10, amplification: 0 },
  WORKER_DEACTIVATED:       { demand:  0,    supply: -0.10, amplification: 0 },
};

const ALL_DELTAS = { ...JOB_DELTAS, ...MARKET_DELTAS };

async function procesarMarketFieldEvent(event) {
  try {
    const eventType = event.type;
    const zoneId    = event.payload?.zona
                   || event.payload?.zoneId
                   || event.payload?.zone;

    if (!eventType || !zoneId) return;
    if (!ALL_DELTAS[eventType]) return;

    const result = await processEvent(eventType, zoneId, event.payload, ALL_DELTAS);
    if (!result) return;

    console.log(`[MarketField] ${eventType} → ${zoneId} | pressure: ${result.marketPressure} | ${result.zoneState}`);

    await checkThresholds(result);
  } catch (err) {
    console.error('[MarketField] error:', err.message);
  }
}

module.exports = { procesarMarketFieldEvent };
