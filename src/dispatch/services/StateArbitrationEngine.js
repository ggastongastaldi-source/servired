const { getSharedClient } = require('../config');
const { logEvent } = require('../events/DispatchEventLog');

function getClient() { return getSharedClient(); }

function offerKey(offerId) { return 'state:offer:' + offerId; }
function lockKey(offerId)  { return 'lock:offer:'  + offerId; }
function effectKey(eventId, effectType) { return 'effect:out:' + eventId + ':' + effectType; }

// Exactly Once Edge Semantics — SET NX EX 86400
async function safeEffect(eventId, effectType, fn) {
  const r = getClient();
  const key = effectKey(eventId, effectType);
  try {
    const acquired = await r.set(key, '1', 'EX', 86400, 'NX');
    if (acquired !== 'OK') {
      console.log('[SAE] safeEffect — already executed', { eventId, effectType });
      return { executed: false, reason: 'ALREADY_EXECUTED' };
    }
    await fn();
    return { executed: true };
  } catch(err) {
    // Si fn() falla, borrar la key para permitir retry
    try { await r.del(key); } catch(e) {}
    console.error('[SAE] safeEffect ERROR', { eventId, effectType, err: err.message });
    throw err;
  }
}

async function initializeOfferState(offerId, pedidoId) {
  try {
    const r = getClient();
    await r.hset(offerKey(offerId),
      'status',              'OPEN',
      'pedidoId',            pedidoId.toString(),
      'createdAt',           Date.now().toString(),
      'lastStreamId',        '0-0',
      'observabilityCursor', '0-0'
    );
    const streamId = await logEvent('OFFER_CREATED', { offerId, pedidoId: pedidoId.toString() });
    if (streamId) {
      await r.hset(offerKey(offerId), 'lastStreamId', streamId);
    }
    console.log('[SAE] initializeOfferState OK', { offerId, pedidoId, streamId });
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

    const streamId = await logEvent('OFFER_ACCEPTED', {
      offerId, workerId: workerId.toString(), idempotencyKey
    });
    if (streamId) {
      await r.hset(offerKey(offerId), 'lastStreamId', streamId);
    }

    console.log('[SAE] markOfferAccepted OK', { offerId, workerId, streamId });
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
    const streamId = await logEvent('OFFER_EXPIRED', { offerId });
    if (streamId) {
      await r.hset(offerKey(offerId), 'lastStreamId', streamId);
    }
    console.log('[SAE] markOfferExpired OK', { offerId, streamId });
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

module.exports = { initializeOfferState, markOfferAccepted, markOfferExpired, getOfferState, safeEffect };
