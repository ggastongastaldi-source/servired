# CreateJobCommand — Contrato Arquitectónico

**Versión:** 1.0 | **Estado:** APROBADO | **Tag:** pre-strangler-fig (2e1a691) | **Fecha:** 2026-07-12

## 1. Contexto

Dos pipelines coexisten sin converger:

- Legacy: HTTP/Socket -> new Pedido() -> save() -> emitEvent(JOB_CREATED) -> iniciarFlujoBusqueda()
- Moderno: POST /api/jobs/request -> emitEvent(JOB_REQUESTED) -> jobRequestedReactor -> DispatchService -> JobOffer

El Watchdog y las queries legacy operan sobre Pedido. El pipeline moderno nunca toca esa coleccion.

## 2. Decision arquitectonica

Estrategia de transicion Event-First con compatibilidad legacy garantizada.

Principio: el documento Pedido deja de ser el origen conceptual y pasa a ser una representacion persistida derivada de un evento canonico.

Patron: Strangler Fig — nueva capa convive con la existente, reemplaza comportamiento de forma incremental, validado por tests de paridad.

## 3. Arquitectura objetivo

    REST / Socket / MCP / Internal
              |
              v
     CreateJobCommand (validacion)
              |
              v
     emitEvent(JOB_CREATED)  <- unica fuente de verdad logica
              |
       +------+------------------+
       v                         v
PedidoProjectionReactor    jobRequestedReactor
(compatibilidad legacy)    (Dispatch / Auction)
       |
       v
    new Pedido() -> save()  <- proyeccion materializada

## 4. CreateJobCommand — Interfaz publica

Requeridos: clienteId, tipoServicio, zona, precio, pagoWorker, source (REST|SOCKET|MCP|INTERNAL)
Opcionales: complejidad (default: baja), descripcion, direccion, ubicacion {lat,lng}, serviceMode (default: URGENT), scheduledFor (requerido si serviceMode != URGENT), correlationId

## 5. Evento canonico — JOB_CREATED

Emisores autorizados:
- CreateJobCommandHandler — unico emisor valido (objetivo)
- NOTA DE TRANSICION: durante Etapas 1-3 coexisten emisores legacy (pedidos.js, socketHandlers.js); el objetivo es eliminarlos gradualmente.

Consumidores autorizados:
- PedidoProjectionReactor — crear doc Pedido legacy (obligatorio durante transicion)
- jobRequestedReactor — enrutar DISPATCH/AUCTION (obligatorio)
- economicGraphProjection — fire-and-forget
- Analytics / SOC — opcional

Contrato del payload: jobId (UUID=aggregateId), clienteId, tipoServicio, zona, complejidad, descripcion, direccion, ubicacion, precio, pagoWorker, serviceMode, scheduledFor, source

Invariantes: JOB_CREATED es inmutable; Pedido derivado nunca modifica el evento; si validacion falla no se emite nada.

## 6. Reglas de validacion

R1: clienteId — string no vacio
R2: tipoServicio — string no vacio, normalizado
R3: zona — string no vacio
R4: precio — number >= 0
R5: pagoWorker — number >= 0 AND <= precio
R6: source — uno de REST/SOCKET/MCP/INTERNAL
R7: scheduledFor — requerido si serviceMode != URGENT; fecha futura
R8: ubicacion — si presente: lat en [-90,90], lng en [-180,180]

Toda violacion lanza ANTES de persistir o emitir eventos.

## 7. Identificadores durante la transicion

- jobId = UUID — identificador canonico del dominio
- Pedido._id = ObjectId — legacy, compatibilidad con Watchdog y queries
- Pedido.jobId = UUID — indexado, puente hacia el nuevo modelo

Consumidores legacy usan _id. Consumidores nuevos usan jobId.

## 8. Idempotencia

La primera version no implementa deduplicacion de comandos — decision consciente para mantener simplicidad en la transicion. La responsabilidad de evitar duplicados recae en el caller. La incorporacion de idempotencyKey queda planificada para una version posterior.

## 9. Compatibilidad legacy — que NO cambia

- iniciarFlujoBusqueda(pedidoId): durante la transicion sigue recibiendo el identificador del documento Pedido persistido; migracion a jobId fuera del alcance de este contrato
- Watchdog: sigue operando sobre documentos Pedido
- Coleccion events de Nexus: mismo formato, mismos indices
- Endpoints HTTP: contratos sin modificacion

## 10. Plan de migracion

Etapa 0 (sin tocar produccion):
- src/application/job/CreateJobCommand.js
- src/application/job/CreateJobCommandHandler.js
- src/infrastructure/reactors/PedidoProjectionReactor.js
- Tests de paridad: legacy vs proyeccion producen Pedido equivalente

Etapa 1 — Punto A (REST):
- src/core/routes/pedidos.js:104 — reemplazar new Pedido() por handler
- Validar con test E2E

Etapa 2 — Punto B (Socket):
- src/core/services/socketHandlers.js:485
- Validar con Debora Rouiller end-to-end

Etapa 3 — Convergencia:
- jobRequestedReactor pasa por CreateJobCommandHandler
- Un unico JOB_CREATED para todos los tracks

Etapa 4 — Migracion de consumidores:
- Cada consumidor evaluado con test de paridad
- Pedido declarado proyeccion cuando ultimo consumidor transaccional migre

## 11. Criterios para retirar Pedido como agregado

1. Ningun endpoint HTTP escribe directamente en Pedido
2. Ningun Socket handler escribe directamente en Pedido
3. Watchdog no depende de Pedido como origen de verdad
4. iniciarFlujoBusqueda acepta jobId (UUID)
5. Tests E2E pasan usando exclusivamente jobId

## 12. Lo que este contrato NO autoriza

- Modificar quoteService, globuloRojo, nexus/, FSMs, Event Store o Dispatch sin Discovery Pass previo
- Cambiar el formato del envelope Nexus
- Emitir JOB_CREATED fuera de CreateJobCommandHandler (salvo emisores legacy durante transicion)
- Modificar _id de documentos Pedido existentes
- Introducir un tercer pipeline de creacion de trabajos

---
Documento generado tras Discovery Pass 2026-07-12.
Proxima revision: al completar Etapa 2 del plan de migracion.
