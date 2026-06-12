# BusPersistenceAdapter - contrato minimo

EventRouter depende de esta interfaz, NUNCA de una implementacion
concreta (Mongo, Mongoose, Atlas, LogManagerV2, BusLogManager, etc.).
La persistencia es un detalle intercambiable.

## Metodo requerido

    persist(eventEnvelope) -> Promise<PersistedEvent>

- eventEnvelope: el evento inmutable producido por createEvent()
  (ya paso validateEvent() una vez en createEvent, y otra vez en
  EventRouter.publish() antes de llegar al adapter).
- Debe devolver una Promise que resuelve a un PersistedEvent:

    PersistedEvent = {
      event: eventEnvelope original, sin modificar,
      persistence: {
        sequence: number,
        stored_at: ISO string,
        ... campos adicionales especificos del adapter
      }
    }

- El adapter NUNCA debe modificar eventEnvelope (es inmutable).
  Toda metadata de persistencia vive en persistence, separada.
- Si persist() rechaza (Promise rejected), EventRouter.publish()
  propaga el error al llamador SIN emitir a los listeners.

## Adapters

- persistenceAdapters/inMemoryAdapter.js - Sprint 3, para tests y
  desarrollo. No persiste entre reinicios del proceso.
- (Sprint 3.1/4) persistenceAdapters/sinapsisBusAdapter.js -
  clonara el patron de hash-chaining de logManagerV2.js sobre una
  coleccion nueva (sinapsis_bus_log), separada del ledger de
  gobernanza de Dixie (sinapsis_log_v2).
