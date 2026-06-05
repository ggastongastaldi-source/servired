const { getSharedClient } = require('../config');
function getClient() { return getSharedClient(); }

function zoneKey(zonaId) { return 'zone:load:' + zonaId; }

async function incrementZoneLoad(zonaId) {
  try {
    const r = getClient();
    const val = await r.incr(zoneKey(zonaId));
    await r.expire(zoneKey(zonaId), 300);
    console.log('[AC] incrementZoneLoad', { zonaId, val });
    return val;
  } catch(err) {
    console.error('[AC] incrementZoneLoad ERROR', { zonaId, err: err.message });
    return 0;
  }
}

async function decrementZoneLoad(zonaId) {
  try {
    const r = getClient();
    const val = await r.decr(zoneKey(zonaId));
    console.log('[AC] decrementZoneLoad', { zonaId, val });
    return Math.max(0, val);
  } catch(err) {
    console.error('[AC] decrementZoneLoad ERROR', { zonaId, err: err.message });
    return 0;
  }
}

async function evaluateDispatchStrategy(zonaId) {
  try {
    const r = getClient();
    const raw = await r.get(zoneKey(zonaId));
    const load = parseInt(raw || '0', 10);
    let strategy;
    if (load < 25)      strategy = 'STANDARD';
    else if (load < 45) strategy = 'STAGGERED_CONGESTED';
    else                strategy = 'FCM_FIRST_DEGRADED';
    console.log('[AC] evaluateDispatchStrategy', { zonaId, load, strategy });
    return { strategy, load };
  } catch(err) {
    console.error('[AC] evaluateDispatchStrategy ERROR', { zonaId, err: err.message });
    return { strategy: 'STANDARD', load: 0 };
  }
}

module.exports = { incrementZoneLoad, decrementZoneLoad, evaluateDispatchStrategy };
