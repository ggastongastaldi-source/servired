# SR-NEURO-004 -- Implementation Gap Analysis

## Metodologia

Discovery Pass sobre codigo real. Cada componente evaluado contra el contrato
del Synaptic Atom definido en SR-NEURO-001.

Pregunta rectora: no crear el Atomo de Sinapsis desde cero, sino demostrar
donde ya existe y que contrato falta para volverlo explicito.

---

## SINAPSIS / Event Store

Existencia: 90%

Componentes auditados:
  shared/events/persistenceAdapters/sinapsisBusAdapter.js
  src/sinapsis/logManagerV2.js

Implementado:
  - Append-only con hash-chain SHA-256 (entryHash + prevHash)
  - Sequence atomica con contador MongoDB (sin race condition)
  - Replay engine con deteccion de gaps y verificacion de integridad
  - Idempotencia por eventId
  - Colecciones separadas: sinapsis_bus_log + sinapsis_log_v2
  - SHI (System Health Index) derivado del replay

Schema actual del bus (sinapsis_bus_log):
  eventId, sequence, eventType, correlationId, causation, actor,
  context, payload, metadata, prevHash, entryHash, sealedAt

Gap -- faltan en el schema:
  - confidence (float 0-1): confianza del evento
  - dce_score (float): Densidad Cognitiva del Evento
  - synthesis (object): resultado de sintesis del Nodo-C
  - plasticity_delta (object): impacto sobre pesos adaptativos

Calificacion: 90% -- columna vertebral existente y solida.

---

## DIXIE / Security Kernel

Existencia: 70%

Componentes auditados:
  src/sinapsis/dixie.js
  src/dixiegate/dixieRuntime.js
  src/sinapsis/dixieTerminal/dixieScanner.js

Implementado:
  - Policy engine determinista: DENY/ESCALATE/ALLOW por risk threshold
  - DixieRuntime proyectivo: garantia de descenso de energia (modelo QP)
  - DixieScanner modo observador: 7 reglas de integridad
  - Circuit Breaker: DEGRADED si CRITICAL+OPEN o 3+ findings en 10min

Gap:
  - DIXIE opera en modo observador -- no bloquea operaciones en produccion
  - Contrato cognitivo para eventos economicos no formalizado
  - dixieRuntime.js con modelo matematico avanzado pero desconectado
    del flujo principal de eventos

Calificacion: 70% -- capa de gobernanza solida pero desconectada del ciclo cognitivo.

---

## GIA / Corteza de interpretacion

Existencia: 80%

Componentes auditados:
  controllers/giaController.js
  services/priorityEngine.js
  routes/osData.js (GET /api/gia/priority)
  src/core/middleware/giaRouter.js
  src/core/contracts/giaRouterContract.js

Implementado:
  - PriorityEngine v1: funcion pura, sin efectos secundarios
  - computePriorityAction(UserState) -> PriorityAction
  - Arbol de prioridades por rol (worker, cliente, merchant)
  - ACTION_TYPES exhaustivo (18 tipos)
  - giaRouter: clasifica intent -> route (aladin | gia_renderer | reject)
  - giaRouterContract: validacion, firma HMAC, politica de no-pricing-data

Flujo actual:
  buildUserState(userId) <- consulta MongoDB directa
       |
  computePriorityAction(state) <- funcion pura
       |
  res.json(action)

Gap critico: GIA consulta MongoDB directamente, no consume atomos sintetizados.
  Modelo SR-NEURO: SINAPSIS (atomos) -> GIA (interpreta) -> accion
  Modelo actual:   MongoDB (query)   -> GIA (calcula)    -> accion

Calificacion: 80% -- logica de priorizacion solida, desacoplada del bus de eventos.

---

## Nodo-C / Unidad cognitiva territorial

Existencia: 50%

Componentes auditados:
  services/marketField/marketFieldEngine.js
  services/marketField/marketFieldProjection.js
  services/marketField/marketFieldReactor.js

Implementado:
  - MarketFieldEngine: lee ZoneState, produce pricingMultiplier y recommendedWorkers
  - computePricingMultiplier: SHORTAGE/SURPLUS/BALANCED
  - rankWorkersForJob: rankea workers por zona y rubro

Gap:
  - marketFieldEngine no emite eventos al bus SINAPSIS despues de decidir
  - No existe sintesis de patron (DemandSpikeDetected del SR-NEURO-001)
  - La deteccion territorial no genera Synaptic Atom

Calificacion: 50% -- seniales territoriales existen, sintesis no.

---

## Plasticidad economica

Existencia: 60%

Componentes auditados:
  src/factories/domain/valueObjects/TrustScore.js

Implementado:
  - TrustScore: value object inmutable con evidencias ponderadas
  - EVIDENCE_WEIGHTS: CUIT_VALIDO(20), AFIP_ACTIVO(25), DIRECCION_FISICA(10)
    CERTIFICACION(15), TRAYECTORIA_1ANO(10), TRAYECTORIA_3ANOS(15), TRAYECTORIA_5ANOS(20)
  - withEvidence(type): inmutable, genera nuevo TrustScore
  - VerificationPolicy: VERIFICADO_PLENO / VERIFICADO / EN_PROCESO / SIN_VERIFICAR

Gap:
  - TrustScore estatico -- no decae por inactividad ni mal desempeno
  - Sin motor de decaimiento temporal (SR-NEURO-002 factores 0.02/0.15/0.05 por semana)
  - Sin conexion entre TrustScore y pesos del PriorityEngine o MarketFieldEngine

Calificacion: 60% -- trust verificable existe, plasticidad operativa no.

---

## DCE / Densidad Cognitiva del Evento

Existencia: 0%

No existe ninguna implementacion.
No hay calculo de valor economico por evento, aprendizaje incorporado
ni costo computacional por ciclo.

Gap total: a crear desde cero sobre el flujo candidato.

---

## Tabla resumen

Componente    Existencia  Gap principal
----------    ----------  -------------
Event Store   90%         confidence, dce_score, synthesis, plasticity_delta
DIXIE         70%         modo observador; desconectado del ciclo principal
GIA           80%         consume MongoDB, no atomos sintetizados
Nodo-C        50%         seniales sin sintesis ni emision al bus
Plasticidad   60%         TrustScore estatico, sin decaimiento temporal
DCE           0%          pendiente completo

Promedio de implementacion SR-NEURO: aproximadamente 60%

---

## Candidato optimo para el primer Synaptic Atom real

Flujo: ServiceRequestCreated -> deteccion territorial -> recomendacion GIA

Por que este flujo:
  1. Existe end-to-end en produccion (pedidos.js + marketFieldEngine + priorityEngine)
  2. Genera valor economico real (matching trabajador-cliente)
  3. Pasa por los tres componentes con mayor existencia (SINAPSIS 90%, GIA 80%)
  4. Demuestra el ciclo completo sin crear infraestructura nueva

Pasos minimos para el primer Synaptic Atom real (todos Nivel 2):
  Paso 1: agregar confidence y synthesis al schema de sinapsis_bus_log
  Paso 2: que marketFieldEngine emita DemandSignalSynthesized al bus
  Paso 3: que giaController consuma el ultimo atomo del bus
           en vez de query directa a MongoDB
  Paso 4: medir DCE del ciclo completo

Ninguno de estos pasos reemplaza infraestructura existente.
Todos son extensiones sobre contratos ya estables.

---

SR-NEURO-004 | v1.0 | ServiRed MOS | Discovery Pass completado
