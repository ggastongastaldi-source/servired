'use strict';

const Redis = require('ioredis');

const REDIS_URL = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || null;
let _available = null;

async function probeRedis() {
  if (!REDIS_URL) { _available = false; return false; }
  return new Promise((resolve) => {
    let probe;
    try {
      probe = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue:   false,
        lazyConnect:          true,
        connectTimeout:       4000,
        retryStrategy:        () => null,
      });
      probe.connect()
        .then(() => {
          try { probe.disconnect(); } catch(_) {}
          _available = true;
          resolve(true);
        })
        .catch(() => {
          try { probe.disconnect(); } catch(_) {}
          _available = false;
          resolve(false);
        });
      probe.on('error', () => {});
    } catch(e) {
      _available = false;
      resolve(false);
    }
  });
}

function isRedisAvailable() { return _available === true; }

let _sharedClient;
function getRedisClient() {
  if (!isRedisAvailable()) return null;
  if (!_sharedClient) {
    _sharedClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    _sharedClient.on('error', (e) => console.error('[Redis] error:', e.message));
  }
  return _sharedClient;
}

module.exports = { probeRedis, isRedisAvailable, getRedisClient };
