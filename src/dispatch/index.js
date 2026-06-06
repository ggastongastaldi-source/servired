const { probeRedis, isRedisAvailable } = require('./config');

let _initialized = false;

async function initDispatchEngine(io) {
  if (_initialized) {
    console.log('[DispatchEngine] already initialized — skip');
    return;
  }
  _initialized = true;

  const redisOk = await probeRedis();
  if (!redisOk) {
    console.warn('[DispatchEngine] Redis no disponible — modo degradado (sin BullMQ)');
    return { dispatchWorker: null, ttlWorker: null };
  }

  const { startDispatchWorker } = require('./queues/dispatchQueue');
  const { startTtlWorker }      = require('./queues/ttlQueue');
  const { registerAcceptOffer } = require('./acceptOfferHandler');

  const dispatchWorker = startDispatchWorker(io);
  const ttlWorker      = startTtlWorker();

  io.on('connection', (socket) => {
    registerAcceptOffer(io, socket);
  });

  console.log('[DispatchEngine] v1.0 iniciado');
  return { dispatchWorker, ttlWorker };
}

module.exports = { initDispatchEngine };
