const Redis = require('ioredis');

// DECISION CERRADA: stream por oferta, nunca stream global
// Format: logs:dispatch:{offerId}
const MAXLEN = 10000;

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

function streamKey(offerId) { return 'logs:dispatch:' + offerId; }

// Events: OFFER_CREATED | OFFER_ACCEPTED | OFFER_EXPIRED | DELIVERY_ACK | FALLBACK_TRIGGERED
async function logEvent(eventType, payload) {
  const offerId = payload.offerId;
  if (!offerId) {
    console.error('[DispatchEventLog] logEvent: offerId requerido', { eventType, payload });
    return null;
  }
  try {
    const client = getClient();
    const streamId = await client.xadd(
      streamKey(offerId), 'MAXLEN', '~', MAXLEN, '*',
      'type',    eventType,
      'payload', JSON.stringify(payload),
      'ts',      Date.now().toString()
    );
    return streamId;
  } catch(err) {
    console.error('[DispatchEventLog] xadd failed:', err.message, { eventType, offerId });
    return null;
  }
}

// Leer eventos de un stream de oferta especifico
async function readOfferEvents(offerId, fromId, count) {
  try {
    const client = getClient();
    const start = fromId || '-';
    const args = count ? [streamKey(offerId), start, '+', 'COUNT', count]
                       : [streamKey(offerId), start, '+'];
    const results = await client.xrange(...args);
    return results.map(([id, fields]) => {
      const obj = { _id: id };
      for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i+1];
      try { obj.payload = JSON.parse(obj.payload); } catch(e) {}
      return obj;
    });
  } catch(err) {
    console.error('[DispatchEventLog] xrange failed:', err.message, { offerId });
    return [];
  }
}

// Contar eventos en el stream de una oferta
async function countOfferEvents(offerId) {
  try {
    const client = getClient();
    return await client.xlen(streamKey(offerId));
  } catch(err) {
    console.error('[DispatchEventLog] xlen failed:', err.message);
    return 0;
  }
}

module.exports = { logEvent, readOfferEvents, countOfferEvents, streamKey };
