'use strict';
const bus      = require('./EventBus');
const registry = require('./ServiceRegistry');
const eventLogger = require('./middleware/eventLogger');
let _started = false;

async function start(io) {
  if (_started) return { bus, registry };
  _started = true;
  bus.use(eventLogger);
  // Servicios se registran aquí a medida que se crean
  // registry.register(new SomeService(io));
  await registry.startAll(bus);
  process.on('SIGTERM', () => registry.stopAll());
  process.on('SIGINT',  () => registry.stopAll());
  console.log('[Runtime] ServiRed OS Runtime v2 iniciado ✓');
  return { bus, registry };
}

// Publicar al bus interno — solo usado por el NexusTap
async function emit(type, payload) {
  await bus.publish({ type, payload, ts: Date.now() });
}

module.exports = { start, emit, bus, registry };
