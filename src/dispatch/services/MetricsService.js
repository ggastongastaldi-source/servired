const { getSharedClient } = require('../config');
function getClient() { return getSharedClient(); }

async function trackDeliveryLatency(offerId, latencyMs) {
  try {
    const r = getClient();
    await r.lpush('metrics:latency:dispatch', JSON.stringify({ offerId, latencyMs, ts: Date.now() }));
    await r.ltrim('metrics:latency:dispatch', 0, 999);
    console.log('[Metrics] trackDeliveryLatency', { offerId, latencyMs });
  } catch(err) {
    console.error('[Metrics] trackDeliveryLatency ERROR', err.message);
  }
}

async function incrementDispatchOutcome(outcome) {
  try {
    const r = getClient();
    await r.incr('metrics:outcome:' + outcome);
    console.log('[Metrics] incrementDispatchOutcome', { outcome });
  } catch(err) {
    console.error('[Metrics] incrementDispatchOutcome ERROR', err.message);
  }
}

module.exports = { trackDeliveryLatency, incrementDispatchOutcome };
