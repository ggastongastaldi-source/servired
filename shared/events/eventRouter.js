// EventRouter - Bus Nervioso Central, Sprint 3.
//
// Responsabilidad: recibir un evento ya valido (de createEvent()),
// re-validarlo (defensa en profundidad para futuros caminos como
// replay), persistirlo via un BusPersistenceAdapter intercambiable
// (ver BUS_PERSISTENCE_CONTRACT.md), y hacer fan-out local a
// listeners suscriptos.
//
// EventRouter NO depende de Mongo/Mongoose/Atlas/LogManagerV2.
// Solo depende de validateEvent() y node:events (built-in).
//
// Orden de ejecucion: validateEvent() -> persist() -> fan-out -> listeners.
// - Si validateEvent() falla: publish() rechaza, nada se persiste, nada se emite.
// - Si persist() falla: publish() rechaza (propaga el error), nada se emite.
// - Si un listener falla (sync o async): se loguea y se aisla; nunca
//   afecta a otros listeners ni al resultado de publish().

const EventEmitter = require('node:events');
const { validateEvent } = require('./validateEvent');

const WILDCARD = '*';

class EventRouter {
  constructor(params) {
    const persistenceAdapter = params && params.persistenceAdapter;

    if (!persistenceAdapter || typeof persistenceAdapter.persist !== 'function') {
      throw new Error(
        'EventRouter requiere un persistenceAdapter con metodo persist(eventEnvelope) -> Promise<PersistedEvent>'
      );
    }

    this._adapter = persistenceAdapter;
    this._emitter = new EventEmitter();
    this._emitter.setMaxListeners(0);
  }

  subscribe(eventType, handler) {
    if (typeof eventType !== 'string' || !eventType) {
      throw new Error('EventRouter.subscribe: eventType debe ser un string no vacio (o "*")');
    }
    if (typeof handler !== 'function') {
      throw new Error('EventRouter.subscribe: handler debe ser una funcion');
    }

    this._emitter.on(eventType, handler);
    return () => this._emitter.off(eventType, handler);
  }

  async publish(event) {
    const result = validateEvent(event);
    if (!result.valid) {
      throw new Error('EventRouter.publish: evento invalido: ' + result.errors.join('; '));
    }

    const persisted = await this._adapter.persist(event);

    this._dispatch(event.event_type, persisted);
    if (event.event_type !== WILDCARD) {
      this._dispatch(WILDCARD, persisted);
    }

    return persisted;
  }

  listenerCount(eventType) {
    return this._emitter.listenerCount(eventType);
  }

  _dispatch(channel, persisted) {
    const listeners = this._emitter.listeners(channel);
    for (const listener of listeners) {
      try {
        const result = listener(persisted);
        if (result && typeof result.catch === 'function') {
          result.catch((err) => {
            this._logListenerError(channel, err);
          });
        }
      } catch (err) {
        this._logListenerError(channel, err);
      }
    }
  }

  _logListenerError(channel, err) {
    console.error(JSON.stringify({
      level: 'error',
      source: 'EventRouter',
      channel: channel,
      error: err && err.message ? err.message : String(err)
    }));
  }
}

module.exports = { EventRouter, WILDCARD };
