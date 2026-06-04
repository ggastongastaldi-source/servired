const Redis = require('ioredis');

const STREAM = 'logs:dispatch';
const MAXLEN  = 10000;

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

async function logEvent(eventType, payload) {
  try {
    const client = getClient();
    await client.xadd(
      STREAM, 'MAXLEN', '~', MAXLEN, '*',
      'type',    eventType,
      'payload', JSON.stringify(payload),
      'ts',      Date.now().toString()
    );
  } catch(err) {
    console.error('[DispatchEventLog] xadd failed:', err.message, { eventType, payload });
  }
}

async function readOfferEvents(offerId) {
  try {
    const client = getClient();
    const results = await client.xrange(STREAM, '-', '+');
    return results
      .map(([id, fields]) => {
        const obj = {};
        for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i+1];
        try { obj.payload = JSON.parse(obj.payload); } catch(e) {}
        obj._id = id;
        return obj;
      })
      .filter(e => e.payload && e.payload.offerId === offerId);
  } catch(err) {
    console.error('[DispatchEventLog] xrange failed:', err.message);
    return [];
  }
}

module.exports = { logEvent, readOfferEvents, STREAM };
