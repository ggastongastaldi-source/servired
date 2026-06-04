const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection() {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue:   false,
    lazyConnect:          true,
  });
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

module.exports = { createRedisConnection, defaultJobOptions, workerOptions };
