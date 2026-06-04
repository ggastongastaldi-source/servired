const Redis = require('ioredis');

let _client;
function getClient() {
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableOfflineQueue:   false,
      lazyConnect:          true,
    });
  }
  return _client;
}

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
