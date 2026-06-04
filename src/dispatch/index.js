const { startDispatchWorker } = require('./queues/dispatchQueue');
const { startTtlWorker }      = require('./queues/ttlQueue');
const { registerAcceptOffer } = require('./acceptOfferHandler');

let _initialized = false;

function initDispatchEngine(io) {
  if (_initialized) {
    console.log('[DispatchEngine] already initialized — skip');
    return;
  }
  _initialized = true;

  const dispatchWorker = startDispatchWorker(io);
  const ttlWorker      = startTtlWorker();

  io.on('connection', (socket) => {
    registerAcceptOffer(io, socket);
  });

  console.log('[DispatchEngine] v1.0 iniciado');
  return { dispatchWorker, ttlWorker };
}

module.exports = { initDispatchEngine };
