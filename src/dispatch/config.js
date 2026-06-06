const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || null;

let _available = null; // null = sin determinar, true/false = resultado del probe

async function probeRedis() {
  if (!REDIS_URL) { _available = false; return false; }
  return new Promise((resolve) => {
    const probe = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue:   false,
      lazyConnect:          true,
      connectTimeout:       4000,
      retryStrategy:        () => null,
    });
    probe.connect()
      .then(() => { probe.disconnect(); _available = true; resolve(true); })
      .catch(() => { probe.disconnect().catch(()=>{}); _available = false; resolve(false); });
  });
}

function isRedisAvailable() { return _available === true; }

let _sharedClient;
function getSharedClient() {
  if (!_sharedClient) {
    _sharedClient = new Redis(REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableOfflineQueue:   false,
      lazyConnect:          true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });
    _sharedClient.on('error', () => {}); // silenciar completamente
  }
  return _sharedClient;
}

function createRedisConnection() {
  const conn = new Redis(REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableOfflineQueue:   false,
    lazyConnect:          true,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 500, 2000);
    },
  });
  conn.on('error', () => {}); // silenciar completamente
  return conn;
}

const defaultJobOptions = {
  attempts:         5,
  backoff:          { type: 'exponential', delay: 1200 },
  removeOnComplete: true,
  removeOnFail:     true,
};

const workerOptions = {
  stalledInterval: 30000,
  lockDuration:    30000,
  maxStalledCount: 1,
  concurrency:     2,
};

module.exports = { createRedisConnection, getSharedClient, defaultJobOptions, workerOptions, probeRedis, isRedisAvailable };
