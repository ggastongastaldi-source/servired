const { getSharedClient } = require('../config');

const MAXLEN = 10000;

function streamKey(offerId) { return 'logs:dispatch:' + offerId; }

async function logEvent(eventType, payload) {
  const offerId = payload.offerId;
  if (!offerId) {
    console.error('[DispatchEventLog] logEvent: offerId requerido', { eventType });
    return null;
  }
  try {
    const r = getSharedClient();
    const streamId = await r.xadd(
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

async function readOfferEvents(offerId, fromId, count) {
  try {
    const r = getSharedClient();
    const start = fromId || '-';
    const args = count
      ? [streamKey(offerId), start, '+', 'COUNT', count]
      : [streamKey(offerId), start, '+'];
    const results = await r.xrange(...args);
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

async function countOfferEvents(offerId) {
  try {
    const r = getSharedClient();
    return await r.xlen(streamKey(offerId));
  } catch(err) {
    console.error('[DispatchEventLog] xlen failed:', err.message);
    return 0;
  }
}

module.exports = { logEvent, readOfferEvents, countOfferEvents, streamKey };
