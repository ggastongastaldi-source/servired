const { getSharedClient } = require('../config');
const { scanOfferStreams } = require('./ReplayTraceEngine');
function getClient() { return getSharedClient(); }

// ProjectionWorker es el UNICO autorizado para ejecutar XTRIM
// Condicion obligatoria: Mongo.lastStreamId === Redis.observabilityCursor
// Si no coinciden: ABORTAR y generar GC_DRIFT_ALERT
async function compactOfferStream(offerId) {
  const r = getClient();
  const alerts = [];

  try {
    // 1. Leer estado Redis
    const state = await r.hgetall('state:offer:' + offerId);
    if (!state) {
      return { offerId, compacted: false, reason: 'STATE_NOT_FOUND' };
    }

    const redisCursor    = state.observabilityCursor || '0-0';
    const redisLastId    = state.lastStreamId       || '0-0';

    // 2. Leer Mongo lastStreamId
    const JobOffer = require('../../models/JobOffer');
    const offer = await JobOffer.findById(offerId).select('lastStreamId').lean();
    const mongoLastId = offer?.lastStreamId || '0-0';

    // 3. Verificar condicion obligatoria
    if (mongoLastId !== redisCursor) {
      const alert = {
        type:    'GC_DRIFT_ALERT',
        offerId,
        mongoLastId,
        redisCursor,
        redisLastId,
      };
      console.error('[ProjectionWorker] GC_DRIFT_ALERT — ABORTAR compactacion', alert);
      alerts.push(alert);
      return { offerId, compacted: false, reason: 'GC_DRIFT_ALERT', alert };
    }

    // 4. Solo compactar si la oferta es terminal
    const terminalStates = ['ACCEPTED', 'EXPIRED', 'CANCELLED_BY_FALLBACK'];
    if (!terminalStates.includes(state.status)) {
      return { offerId, compacted: false, reason: 'NOT_TERMINAL' };
    }

    // 5. XTRIM — mantener ultimos 100 eventos (no borrar todo)
    const streamName = 'logs:dispatch:' + offerId;
    await r.xtrim(streamName, 'MAXLEN', '~', 100);

    // 6. Actualizar cursor
    await r.hset('state:offer:' + offerId, 'observabilityCursor', redisLastId);

    console.log('[ProjectionWorker] compactOfferStream OK', { offerId, redisLastId });
    return { offerId, compacted: true, newCursor: redisLastId };

  } catch(err) {
    console.error('[ProjectionWorker] compactOfferStream ERROR', { offerId, err: err.message });
    return { offerId, compacted: false, reason: 'ERROR', err: err.message };
  }
}

// Compactar todos los streams terminales (SCAN, no KEYS)
async function compactAllTerminalStreams() {
  const results = [];
  try {
    const streams = await scanOfferStreams('logs:dispatch:*', 100);
    for (const streamName of streams) {
      const offerId = streamName.replace('logs:dispatch:', '');
      const result = await compactOfferStream(offerId);
      results.push(result);
    }
    console.log('[ProjectionWorker] compactAllTerminalStreams completo', {
      total: streams.length,
      compacted: results.filter(r => r.compacted).length,
      alerts: results.filter(r => r.reason === 'GC_DRIFT_ALERT').length,
    });
    return results;
  } catch(err) {
    console.error('[ProjectionWorker] compactAllTerminalStreams ERROR', err.message);
    return [];
  }
}

module.exports = { compactOfferStream, compactAllTerminalStreams };
