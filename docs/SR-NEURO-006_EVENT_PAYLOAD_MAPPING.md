# SR-NEURO-006 -- ServiceRequestCreated Payload Mapping

## Objetivo

Comparar el evento conceptual ServiceRequestCreated contra el payload
que realmente emite ServiRed hoy, para determinar que campos estan
disponibles para el primer Synaptic Atom sin modificar logica existente.

---

## Fuentes auditadas

  src/application/job/CreateJobCommand.js
  src/application/job/CreateJobCommandHandler.js
  src/domain/pedido/Pedido.js
  src/domain/pedido/events/PedidoDomainEvents.js
  src/infrastructure/events/SinapsisEventAdapter.js

---

## Evento real emitido hoy

Nombre en dominio: JobCreated
Nombre en bus SINAPSIS: JOB_CREATED (via TIPO_MAP en SinapsisEventAdapter)

Estructura real (PedidoDomainEvents.jobCreated):

  eventId:      randomUUID()
  type:         'JobCreated'
  aggregateId:  jobId (UUID)
  occurredAt:   new Date()
  payload:
    clienteId:    string (MongoDB ObjectId)
    tipoServicio: string (rubro del servicio)
    zona:         string (zoneId del territorio)
    precio:       number (Dinero.monto ARS)
    pagoWorker:   number (Dinero.monto ARS)

Campos en CreateJobCommand disponibles en el flujo pero
no incluidos en el payload del evento hoy:
  complejidad, descripcion, direccion, ubicacion,
  serviceMode, scheduledFor, source, correlationId

Contexto de transporte (SinapsisEventAdapter):
  entityType:    'pedido'
  aggregateId:   String(de.aggregateId)
  correlationId: ctx.correlationId ?? null
  causationId:   de.eventId

---

## Mapeo contra Synaptic Atom (SR-NEURO-005)

Campo SR-NEURO-005       Campo real disponible       Estado
-----------------        --------------------        ------
eventType                type: 'JobCreated'          DIRECTO
timestamp                occurredAt                  DIRECTO
payload.clienteId        payload.clienteId           DIRECTO
payload.tipoServicio     payload.tipoServicio         DIRECTO (category)
payload.zona             payload.zona                DIRECTO (territory)
payload.precio           payload.precio              DIRECTO
correlationId            ctx.correlationId           DIRECTO
causationId              de.eventId                  DIRECTO
memory.hash              entryHash (bus adapter)     EXISTENTE
memory.previousHash      prevHash  (bus adapter)     EXISTENTE
memory.sequence          sequence  (bus adapter)     EXISTENTE
confidence               --                          FALTANTE (Nodo-C)
synthesis.pattern        --                          FALTANTE (Nodo-C)
synthesis.evidence       --                          FALTANTE (Nodo-C)
dce.score                --                          FALTANTE (DCE Engine)
plasticity.delta         --                          FALTANTE (Plasticity Engine)
dixie.status             --                          FALTANTE (DIXIE desconectado)

---

## Campos disponibles para el primer atomo sin logica nueva

  eventType, timestamp, correlationId, causationId
  payload: clienteId, tipoServicio, zona, precio, pagoWorker
  memory:  sequence, hash, previousHash (sinapsisBusAdapter ya los produce)

---

## Campos que requieren implementacion nueva

  confidence, synthesis.pattern, synthesis.evidence  -- Nodo-C / marketFieldEngine
  dixie.status                                       -- DIXIE conectado al flujo
  dce.score                                          -- DCE Engine (a crear)
  plasticity.delta                                   -- Plasticity Engine (a crear)

---

## Decision para el primer patch Nivel 2

Paso 1: extender sinapsisBusAdapter con campos opcionales (default null):
  confidence (Number), synthesis (Mixed), dce (Mixed), plasticity (Mixed)
  Los eventos existentes no se rompen. Sin migracion requerida.

Paso 2: marketFieldEngine escribe synthesis y confidence cuando procesa
  una zona con ZoneState activo, convirtiendo ese ciclo en el primer
  Synaptic Atom con inteligencia territorial real.

---

SR-NEURO-006 | v1.0 | ServiRed MOS | Payload Mapping completado
