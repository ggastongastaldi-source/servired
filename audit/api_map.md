# API MAP — Todas las rutas
> 2026-06-28 20:06

## routes/activity.js
  GET /:comercioId  (línea 23)
  POST /  (línea 42)
  PATCH /:id/aprobar  (línea 50)
  PATCH /:id/rechazar  (línea 58)
  PATCH /:id/ejecutado  (línea 66)
  PATCH /:id/error  (línea 77)

## routes/boost.js
  POST /iniciar  (línea 11)

## routes/catalogo.js
  POST /  (línea 21)
  GET /:commerceId  (línea 65)
  GET /  (línea 78)
  POST /presupuesto  (línea 92)
  POST /presupuesto/espacio  (línea 107)

## routes/cobroRoutes.js
  GET /estado  (línea 20)
  POST /solicitar  (línea 47)
  GET /health  (línea 92)

## routes/economicGraph.js
  GET /zone/:zoneId  (línea 6)
  GET /node/:nodeType/:entityId/neighbors  (línea 14)
  GET /zone/:zoneId/top  (línea 23)

## routes/events.js
  POST /  (línea 5)

## routes/evidence.js
  POST /  (línea 7)

## routes/gatewayRoutes.js
  GET /metrics  (línea 14)
  GET /health  (línea 20)
  POST /process  (línea 32)
  POST /freeze  (línea 42)
  POST /unfreeze  (línea 48)
  POST /shadow  (línea 54)
  POST /rollback/:ruleId  (línea 61)
  POST /seed  (línea 71)

## routes/gia.js
  POST /consulta  (línea 6)
  DELETE /conversacion/:comercioId  (línea 28)

## routes/giaRoutes.js
  GET /health  (línea 8)
  GET /priority  (línea 9)

## routes/health.js
  GET /  (línea 18)

## routes/merchantRoutes.js
  GET /health  (línea 7)
  GET /profile  (línea 10)
  POST /profile  (línea 11)
  PATCH /profile  (línea 12)
  GET /dashboard  (línea 15)
  GET /catalog  (línea 18)
  POST /catalog  (línea 19)
  PATCH /catalog/:itemId  (línea 20)
  DELETE /catalog/:itemId  (línea 21)
  GET /analytics  (línea 24)
  POST /admin/reconstruct  (línea 27)

## routes/policyRoutes.js
  GET /  (línea 11)
  POST /  (línea 25)
  POST /:ruleId/activate  (línea 35)
  POST /:ruleId/rollback  (línea 46)
  POST /:ruleId/freeze  (línea 56)
  POST /evaluate  (línea 66)

## routes/quotes.js
  POST /  (línea 75)
  POST /:id/send  (línea 107)
  PATCH /:id  (línea 126)
  POST /:id/withdraw  (línea 153)
  POST /:id/select  (línea 173)
  POST /:id/expire  (línea 206)
  GET /:id  (línea 227)
  GET /by-request/:requestId  (línea 242)
  GET /auction-outcome/:requestId  (línea 256)

## routes/rtmilStatus.js
  GET /status  (línea 5)
  POST /aladin/run  (línea 13)
  GET /ode  (línea 25)
  POST /ode/aggregate  (línea 35)

## routes/simulationRoutes.js
  POST /test  (línea 13)
  POST /replay  (línea 25)
  GET /drift  (línea 40)
  POST /drift  (línea 50)

## routes/sync.js
  POST /command  (línea 22)

## routes/track.js
  POST /  (línea 13)

