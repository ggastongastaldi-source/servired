'use strict';
const bus      = require('./EventBus');
const registry = require('./ServiceRegistry');
const eventLogger = require('./middleware/eventLogger');
const NotificationService = require('./services/NotificationService');
const AnalyticsService = require('./services/AnalyticsService');
const ObserverService = require('./services/ObserverService');

let _observerHook = null;

let _started = false;

async function start(io) {
  if (_started) return { bus, registry };
  _started = true;
  bus.use(eventLogger);
  // Servicios se registran aquí a medida que se crean
  // registry.register(new SomeService(io));
  registry.register(new NotificationService(io));
  registry.register(new AnalyticsService());
  __observerInstance = new ObserverService();
registry.register(__observerInstance);
if (typeof __observerInstance.start === 'function') {
  try { __observerInstance.start(bus); } catch (e) { console.error('[Observer-start-fail]', e.message); }
}
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


const originalEmit = module.exports.emitEvent;
if (originalEmit) {
  module.exports.emitEvent = function(event) {
    if (_observerHook) {
      try { _observerHook(event); } catch(e) {}
    }
    return originalEmit.apply(this, arguments);
  };
}

module.exports = { start, emit, bus, registry };
