# ServiRed OS — Roadmap de Fases (Motor Economico)

status: REFERENCIA VIGENTE
version: 1.0
date: 2026-06-20

---

## Marco

ServiRed OS no se evalua como marketplace ni app de servicios.
Es un Sistema Operativo Economico Territorial en construccion.

Secuencia constitucional: Evento -> Proyeccion -> Metrica -> Decision -> Accion

---

## Fase 1 — Captura del mundo fisico

Estado: PARCIALMENTE PENDIENTE

Implementado:
- localCommandQueue.js (captura de comandos, offline-first)

Pendiente:
- Captura por foto/voz/texto
- Integracion con Claude Vision para clasificacion de imagenes

---

## Fase 2 — Clasificacion

Estado: PENDIENTE

Pendiente:
- Motor de clasificacion via Claude Vision
- Catalogo de categorias territoriales
- Mapeo foto -> producto -> categoria -> precio estimado

---

## Fase 3 — Matching (Cliente <-> Trabajador <-> Comercio)

Estado: PARCIALMENTE IMPLEMENTADA

Implementado:
- NEXUS Auction Engine (bid scoring)
- DPI Service (presion de demanda por zona)
- Event Taxonomy con WorkerAssigned, JobStarted

Pendiente:
- Matching automatico disparado por clasificacion de Fase 2

---

## Fase 4 — Reserva (MaterialReservation)

Estado: IMPLEMENTADA

- routes/sync.js: POST /api/sync/command
- TriggerMaterialReservation -> MaterialReservationRequested
- ConfirmReservation -> ReservationConfirmed
- RejectReservation -> ReservationRejected
- PublishWorkProgress -> WorkProgressReported
- IdempotencyRecord.js: idempotencia transaccional, TTL 30 dias
- localCommandQueue.js + syncEngine.js: offline-first end-to-end

---

## Fase 5 — Aprendizaje Territorial

Estado: PARCIALMENTE IMPLEMENTADO

Implementado:
- DPI RFC-001 (formula congelada, DPI + DPI_velocity)
- Event Taxonomy con eventos Operational/Economic separados
- Territorial Mesh (decisiones congeladas previamente)

Pendiente:
- EconomicScore como servicio activo (formula definida, no implementado)
- CommerceEfficiencyIndex como read model activo
- PopulationNormalized (open question de DPI RFC-001, sin resolver)

---

## Fase 6 — Monetizacion

Estado: NO INICIADA (deliberadamente)

No se empieza hasta resolver Fase 1-2:
- Mercado de Visibilidad Territorial (no ads clasicos)
- Suscripciones comerciales
- Boost dinamico (formula ya definida en sesiones previas)

---

## Infraestructura constitucional ya consolidada (no se reconstruye)

- Event Store: sinapsisBusAdapter.js (hash-chain, ADR-005)
- Event Taxonomy Registry: constants/eventTaxonomy.js
- State Machine central: constants/states.js
- Sync Engine: RFC-UX-002 (cliente) + RFC-SYNC-001B (servidor)
- Identidad: actorId = Usuario._id via JWT existente (sin Google OAuth)
- UX Constitution v1.2: PWA, no React Native

---

## Proxima prioridad estrategica

Fase 1 + Fase 2: conectar el mundo fisico al motor economico.

Foto -> Clasificacion (Claude Vision) -> Enriquecimiento territorial -> Matching

Esto es lo que diferencia a ServiRed de un marketplace generico.
No se empieza Fase 6 sin esto resuelto primero.

---

## Addendum (sesion 2, 2026-06-20) - Hallazgo critico pre-Captura

Antes de Capture Contract v1: localCommandQueue.js no genera ni
persiste deviceId ni clientSequence, pero routes/sync.js los exige.
El pipeline de Fase 4 esta construido pero NO es funcional de punta a
punta todavia. Orden correcto para la proxima sesion:

1. Agregar deviceId + clientSequence a localCommandQueue.js
2. Probar el pipeline completo con un comando real
3. Recien despues, Capture Contract v1 - reusando nombres existentes
   (attempts, no retryCount; commandId como unica clave de idempotencia,
   no agregar idempotencyKey en paralelo)
