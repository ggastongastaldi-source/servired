# Sprint 3.1 - Eliminacion de endpoint huerfano

## Que se elimino

POST /api/referidos/convertir (src/routes/referidos.js)

## Evidencia

grep -rn "convertir" en todo el repo (excluyendo node_modules/.git)
solo encontro la definicion del endpoint en src/routes/referidos.js
(lineas 23, 25, 35). Cero callers en public/*.html, src/core/routes/auth.js,
ni en ningun otro archivo.

## Por que existia ambiguedad causal

Habia dos productores potenciales del mismo efecto de negocio
(Referido.stats.registros / clientes / workers):

- Camino A (real, en uso): registrarOrigenAtribucion() dentro de
  src/core/routes/auth.js, disparado por POST /api/auth/registro.
- Camino B (muerto): POST /api/referidos/convertir.

Si el Camino B se hubiera conectado mas adelante sin conocer el A,
cada registro habria incrementado las estadisticas dos veces.

## Estado final

Solo queda GET /api/referidos/resolver (incrementa stats.scans).
La atribucion de registros/clientes/workers sigue siendo
responsabilidad exclusiva de registrarOrigenAtribucion() en auth.js.

## Siguiente paso

Sprint 3.2 - reconectar SessionContext.setOriginRef() en qr-landing.js
(actualmente usa sessionStorage.setItem('origin_ref', ref) directo).

---

# Sprint 3.2 - SessionContext reconectado

## Hallazgo adicional

session-context.js (Sprint 2.1) nunca estaba incluido en index.html.
SessionContext era undefined en el navegador.

## Cambios

1. public/index.html: agregado <script src="/js/session-context.js">
   ANTES de qr-landing.js (orden de carga importa: SessionContext
   debe existir en window antes de que qr-landing.js se ejecute).
2. public/js/qr-landing.js: sessionStorage.setItem('origin_ref', ref)
   -> SessionContext.setOriginRef(ref).

## Estado final

origin_ref ahora pasa por el unico punto de entrada centralizado.
correlation_id y last_event (las otras dos claves de SessionContext)
siguen sin productores reales - se conectaran en Sprint 3.3
(qr_scanned / register_completed / lead_attributed).

---

# Sprint 3.3 - Primeros productores reales del Bus

## Piezas nuevas (aditivas)

- shared/events/referral-events.js: emitQrScanned, emitRegisterCompleted,
  emitLeadAttributed (mismo patron que shell-events.js, EVENT_TYPES
  existentes desde Sprint 1).
- shared/events/router-instance.js: singleton EventRouter +
  inMemoryAdapter (sin Mongo, sin hash-chaining - fase de observacion)
  + listener WILDCARD que loguea cada evento (volumen/correlacion/
  causation/payload visibles en logs de Render).

## Cambios en codigo existente

- src/routes/referidos.js (GET /resolver): emite qr_scanned (root event),
  y agrega a la respuesta JSON existente dos campos nuevos:
  correlation_id y last_event {event_id, event_type}.
- public/js/qr-landing.js: si la respuesta trae correlation_id/last_event,
  los guarda via SessionContext.recordEvent().
- public/index.html (registrar/registrarTrabajador): el body de
  POST /api/auth/registro ahora incluye origin_ref via
  SessionContext.getOriginRef() (antes sessionStorage directo) y
  correlationId/causation via SessionContext.getCausalContext().
- src/core/routes/auth.js: nueva funcion emitBusEventsForRegistro()
  emite register_completed siempre, y lead_attributed si origin_ref
  esta presente (causation = register_completed recien emitido).

## Cadena causal end-to-end esperada

qr_scanned (root, correlation_id = su propio event_id)
  -> register_completed (mismo correlation_id, causation = qr_scanned)
    -> lead_attributed (mismo correlation_id, causation = register_completed)

## Garantias de no-regresion

- Todos los emitX().catch(()=>{}) son fire-and-forget: si el EventRouter
  falla, el registro/scan sigue funcionando igual que antes.
- Campos nuevos en request/response son aditivos (no rompen consumidores
  existentes que no los lean).
- Tests: 37/37 OK (tests/events + tests/frontend).

## Limitacion conocida

inMemoryAdapter no persiste entre reinicios del proceso (Render free tier
duerme tras inactividad). Los eventos solo viven en memoria durante esta
fase de observacion. BusLogManager/sinapsis_bus_log = Sprint 3.1/4 (segun
volumen/evidencia real observada en logs).
