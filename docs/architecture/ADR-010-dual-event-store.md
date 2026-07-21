# ADR-010 -- Dos Event Stores: Nexus/events vs SINAPSIS/sinapsis_bus_log

Estado: ACEPTADO | Fecha: 2026-07-21

---

## Contexto

Durante la implementacion del puente SR-NEURO (commits 152bdcd y c606110)
se detectaron dos sistemas de persistencia de eventos en produccion:

  Nexus:    nexus/events/emitEvent()    -> coleccion 'events'
  SINAPSIS: sinapsisBusAdapter.persist() -> coleccion 'sinapsis_bus_log'

Ambos son append-only. La distincion no estaba documentada. Esto genero un bug:
JOB_ATOM_SYNTHESIZED fue emitido via emitEvent() pero osData.js consulta
SinapsisBusLog, por lo que el atomo nunca era encontrado por el consumidor cognitivo.

---

## Responsabilidades

### coleccion 'events' -- Nexus Event Store

Proposito: runtime operacional. Velocidad, reactividad.
Productores: emitEvent() desde cualquier parte del sistema.
Consumidores: NexusTap, EconomicGraphProjection, DixieGate, reactores legacy.
Caracteristicas:
  - OCC por aggregateId + sequenceNumber
  - Sin hash-chain criptografico
  - Sin campos SR-NEURO (confidence, synthesis, dce, plasticity)

### coleccion 'sinapsis_bus_log' -- SINAPSIS Bus

Proposito: memoria cognitiva auditada. System of Record para GIA y SR-NEURO.
Productores: sinapsisBusAdapter.persist() unicamente.
Consumidores: osData.js /api/gia/priority, busReplay(), pipeline SR-NEURO.
Caracteristicas:
  - Hash-chain SHA-256 (entryHash + prevHash)
  - Sequence atomica sin race condition
  - Campos SR-NEURO completos (confidence, synthesis, dce, plasticity)
  - Idempotencia por eventId
  - SHI (System Health Index) via replay

---

## Decision

Los dos Event Stores son INTENCIONALES. No son duplicacion. No deben fusionarse.

  events           -- sistema nervioso periferico (respuesta rapida)
  sinapsis_bus_log -- hipocampo (memoria cognitiva, aprendizaje, integridad)

---

## Reglas de uso

REGLA 1: Evento cognitivo (Synaptic Atom) siempre persiste en sinapsis_bus_log.
  Usar: sinapsisBusAdapter.persist()
  Nunca: emitEvent() para eventos consumidos por GIA o SR-NEURO.

REGLA 2: Evento operacional (reactividad en tiempo real) usa emitEvent().
  Usar: emitEvent() para reactores, proyecciones, NexusTap.
  Nunca: sinapsisBusAdapter para eventos sin carga cognitiva.

REGLA 3: Un evento puede publicarse en ambos si tiene responsabilidades duales.
  Ejemplo: JOB_CREATED via emitEvent (reactor) + JOB_ATOM_SYNTHESIZED
  via busAdapter (cognitivo). Son eventos distintos con propositos distintos.

REGLA 4: osData.js y consumidores cognitivos SOLO leen sinapsis_bus_log.
  Nunca consultar la coleccion 'events' para derivar inteligencia territorial.

REGLA 5: synthesis != null es condicion para que un atomo sea cognitivamente valido.

---

## Consecuencias

Positivas:
  - Separacion clara entre runtime y memoria cognitiva.
  - sinapsis_bus_log mantiene integridad criptografica sin afectar velocidad.
  - GIA siempre lee de una fuente auditada y verificable.
  - SR-NEURO puede evolucionar sin tocar el runtime operacional.

A gestionar:
  - Productores que generen Synaptic Atoms deben usar busAdapter, no emitEvent.
  - La documentacion de cada nuevo evento debe indicar a cual store pertenece.

---

## Referencias

  SR-NEURO-005 -- Synaptic Atom Contract
  SR-NEURO-006 -- Event Payload Mapping
  commit c606110 -- fix: JOB_ATOM_SYNTHESIZED a sinapsis_bus_log
  shared/events/persistenceAdapters/sinapsisBusAdapter.js
  nexus/events/emitEvent.js

ADR-010 | v1.0 | ServiRed MOS
