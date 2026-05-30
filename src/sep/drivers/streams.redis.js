// streams.redis.js — Redis Streams real via ioredis
const Redis = require('ioredis');

let pub, sub;

function getClients() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  if (!pub) pub = new Redis(url);
  if (!sub) sub = new Redis(url);
  return { pub, sub };
}

async function publish(streamName, event) {
  const { pub } = getClients();
  const flat = ['event', JSON.stringify(event)];
  await pub.xadd(streamName, '*', ...flat);
}

async function consume(streamName, group, batchSize = 10) {
  const { sub } = getClients();
  try {
    await sub.xgroup('CREATE', streamName, group, '$', 'MKSTREAM');
  } catch(e) { /* group ya existe */ }

  const results = await sub.xreadgroup(
    'GROUP', group, 'worker-1',
    'COUNT', batchSize,
    'BLOCK', 500,
    'STREAMS', streamName, '>'
  );

  if (!results) return [];
  return results[0][1].map(([id, fields]) => ({
    _id: id,
    event: JSON.parse(fields[1]),
    attempts: 0,
  }));
}

async function ack(id, group, streamName = 'sep:events') {
  const { sub } = getClients();
  await sub.xack(streamName, group, id);
}

async function nack(id) {
  // Redis no tiene nack nativo — el mensaje queda en PEL para retry
}

module.exports = { publish, consume, ack, nack };
