const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton compartido para operaciones directas (no BullMQ)
let _sharedClient;
function getSharedClient() {
  if (!_sharedClient) {
    _sharedClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue:   false,
      lazyConnect:          true,
      retryStrategy: (times) => {
        if (times > 5) return null; // dejar de reintentar
        return Math.min(times * 500, 3000);
      },
    });
    _sharedClient.on('error', (err) => {
      // Silenciar errores de conexion — no crashear el proceso
      if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT') {
        console.error('[Redis] connection error:', err.message);
      }
    });
  }
  return _sharedClient;
}

// Conexion separada para BullMQ — requiere maxRetriesPerRequest: null
function createRedisConnection() {
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue:   false,
    lazyConnect:          true,
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 500, 3000);
    },
  });
  conn.on('error', (err) => {
    if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT') {
      console.error('[Redis/BullMQ] connection error:', err.message);
    }
  });
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

module.exports = { createRedisConnection, getSharedClient, defaultJobOptions, workerOptions };
