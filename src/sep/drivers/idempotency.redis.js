// idempotency.redis.js — Redis SET NX con TTL
const Redis = require('ioredis');

let client;
function getClient() {
  if (!client) client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  return client;
}

const TTL = 86400; // 24h

async function acquire(key) {
  const r = getClient();
  const rkey = 'idem:' + key;
  const set = await r.set(rkey, 'PENDING', 'EX', TTL, 'NX');
  if (set === 'OK') return { acquired: true };
  const status = await r.get(rkey);
  return { acquired: false, existing: { key, status: status || 'UNKNOWN' } };
}

async function markProcessing(key) {
  const r = getClient();
  await r.set('idem:' + key, 'PROCESSING', 'EX', TTL, 'XX');
}

async function markDone(key, result) {
  const r = getClient();
  await r.set('idem:' + key, 'DONE', 'EX', TTL, 'XX');
  await r.set('idem:result:' + key, JSON.stringify(result), 'EX', TTL);
}

async function get(key) {
  const r = getClient();
  const status = await r.get('idem:' + key);
  if (!status) return null;
  const resultRaw = await r.get('idem:result:' + key);
  return { key, status, result: resultRaw ? JSON.parse(resultRaw) : null };
}

module.exports = { acquire, markProcessing, markDone, get };
