const Redis = require('ioredis');
const { logEvent } = require('../events/DispatchEventLog');

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

function offerKey(offerId) { return 'state:offer:' + offerId; }
function lockKey(offerId)  { return 'lock:offer:'  + offerId; }

async function initializeOfferState(offerId, pedidoId) {
  try {
    const r = getClient();
    await r.hset(offerKey(offerId),
      'status',    'OPEN',
      'pedidoId',  pedidoId.toString(),
      'createdAt', Date.now().toString()
    );
    await logEvent('OFFER_CREATED', { offerId, pedidoId: pedidoId.toString() });
    console.log('[SAE] initializeOfferState OK', { offerId, pedidoId });
  } catch(err) {
    console.error('[SAE] initializeOfferState ERROR', { offerId, pedidoId, err: err.message });
    throw err;
  }
}

async function markOfferAccepted(offerId, workerId, idempotencyKey) {
  const r = getClient();
  const lock = lockKey(offerId);
  try {
    const acquired = await r.set(lock, workerId.toString(), 'EX', 10, 'NX');
    if (acquired !== 'OK') {
      console.log('[SAE] markOfferAccepted — lock held', { offerId, workerId });
      return { success: false, reason: 'LOCK_NOT_ACQUIRED' };
    }

    const set = await r.hsetnx(offerKey(offerId), 'terminalState', 'ACCEPTED');
    if (!set) {
      await r.del(lock);
      const current = await r.hget(offerKey(offerId), 'terminalState');
      console.log('[SAE] markOfferAccepted — already terminal', { offerId, current });
      return { success: false, reason: 'ALREADY_TERMINAL', current };
    }

    await r.hset(offerKey(offerId),
      'status',     'ACCEPTED',
      'acceptedBy', workerId.toString(),
      'acceptedAt', Date.now().toString()
    );

    await logEvent('OFFER_ACCEPTED', { offerId, workerId: workerId.toString(), idempotencyKey });
    console.log('[SAE] markOfferAccepted OK', { offerId, workerId });
    return { success: true };

  } catch(err) {
    console.error('[SAE] markOfferAccepted ERROR', { offerId, workerId, err: err.message });
    try { await r.del(lock); } catch(e) {}
    throw err;
  }
}

async function markOfferExpired(offerId) {
  const r = getClient();
  try {
    const set = await r.hsetnx(offerKey(offerId), 'terminalState', 'EXPIRED');
    if (!set) {
      const current = await r.hget(offerKey(offerId), 'terminalState');
      console.log('[SAE] markOfferExpired — already terminal', { offerId, current });
      return { success: false, reason: 'ALREADY_TERMINAL', current };
    }
    await r.hset(offerKey(offerId), 'status', 'EXPIRED', 'expiredAt', Date.now().toString());
    await logEvent('OFFER_EXPIRED', { offerId });
    console.log('[SAE] markOfferExpired OK', { offerId });
    return { success: true };
  } catch(err) {
    console.error('[SAE] markOfferExpired ERROR', { offerId, err: err.message });
    throw err;
  }
}

async function getOfferState(offerId) {
  try {
    const r = getClient();
    return await r.hgetall(offerKey(offerId));
  } catch(err) {
    console.error('[SAE] getOfferState ERROR', { offerId, err: err.message });
    return null;
  }
}

module.exports = { initializeOfferState, markOfferAccepted, markOfferExpired, getOfferState };
