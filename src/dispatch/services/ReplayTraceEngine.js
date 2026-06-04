const Redis = require('ioredis');
const { readOfferEvents, streamKey } = require('../events/DispatchEventLog');

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

// NUNCA usar KEYS — usar SCAN con cursor
async function scanOfferStreams(match, count) {
  const r = getClient();
  const pattern = match || 'logs:dispatch:*';
  const batchSize = count || 100;
  const streams = [];
  let cursor = '0';

  do {
    const [nextCursor, keys] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
    cursor = nextCursor;
    streams.push(...keys);
  } while (cursor !== '0');

  return streams;
}

// Auditar drift: cursor mismatch, side effects faltantes, snapshots inconsistentes
async function auditOfferDrift(offerId) {
  const r = getClient();
  const issues = [];

  try {
    // 1. Leer estado Redis
    const state = await r.hgetall('state:offer:' + offerId);
    if (!state || Object.keys(state).length === 0) {
      issues.push({ type: 'REDIS_STATE_MISSING', offerId });
      return { offerId, issues };
    }

    // 2. Leer Mongo snapshot
    const JobOffer = require('../../models/JobOffer');
    const offer = await JobOffer.findById(offerId).lean();
    if (!offer) {
      issues.push({ type: 'MONGO_SNAPSHOT_MISSING', offerId });
    }

    // 3. Verificar cursor mismatch
    const redisCursor = state.observabilityCursor || '0-0';
    const redisLastId = state.lastStreamId || '0-0';

    if (redisCursor !== redisLastId && redisCursor !== '0-0') {
      issues.push({
        type:   'CURSOR_MISMATCH',
        offerId,
        cursor: redisCursor,
        lastId: redisLastId,
      });
    }

    // 4. Verificar consistencia de status
    if (offer && state.status !== offer.status) {
      issues.push({
        type:       'CACHE_DIVERGENCE',
        offerId,
        redisStatus: state.status,
        mongoStatus: offer.status,
      });
    }

    // 5. Verificar side effects — OFFER_ACCEPTED debe tener effect:out registrado
    if (state.status === 'ACCEPTED') {
      const events = await readOfferEvents(offerId, null, 50);
      const acceptedEvent = events.find(e => e.type === 'OFFER_ACCEPTED');
      if (acceptedEvent) {
        const effectKey = 'effect:out:' + acceptedEvent._id + ':socket';
        const effectExists = await r.exists(effectKey);
        if (!effectExists) {
          issues.push({ type: 'MISSING_SIDE_EFFECT', offerId, eventId: acceptedEvent._id, effectType: 'socket' });
        }
      }
    }

    return { offerId, issues, state, mongoStatus: offer?.status };

  } catch(err) {
    console.error('[ReplayTraceEngine] auditOfferDrift ERROR', { offerId, err: err.message });
    return { offerId, issues: [{ type: 'AUDIT_ERROR', err: err.message }] };
  }
}

// Auditar todos los streams activos (SCAN, no KEYS)
async function auditAllActiveOffers() {
  const issues = [];
  try {
    const streams = await scanOfferStreams('logs:dispatch:*', 100);
    console.log('[ReplayTraceEngine] auditAllActiveOffers — streams encontrados:', streams.length);

    for (const streamName of streams) {
      const offerId = streamName.replace('logs:dispatch:', '');
      const result = await auditOfferDrift(offerId);
      if (result.issues.length > 0) {
        issues.push(...result.issues);
      }
    }

    console.log('[ReplayTraceEngine] audit completo — issues:', issues.length);
    return issues;
  } catch(err) {
    console.error('[ReplayTraceEngine] auditAllActiveOffers ERROR', err.message);
    return [{ type: 'AUDIT_GLOBAL_ERROR', err: err.message }];
  }
}

module.exports = { auditOfferDrift, auditAllActiveOffers, scanOfferStreams };
