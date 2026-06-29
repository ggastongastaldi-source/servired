# FRONTEND CONTRACT
> 2026-06-28 20:06
> Qué necesita cada pantalla del backend real

---
## Módulo: `activity`

### Endpoints
  `GET /:comercioId`
  `POST /`
  `PATCH /:id/aprobar`
  `PATCH /:id/rechazar`
  `PATCH /:id/ejecutado`
  `PATCH /:id/error`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔒 Sí (1 referencias)

### Estados / enums detectados
  - pendiente

---
## Módulo: `boost`

### Endpoints
  `POST /iniciar`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `catalogo`

### Endpoints
  `POST /`
  `GET /:commerceId`
  `GET /`
  `POST /presupuesto`
  `POST /presupuesto/espacio`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `cobroRoutes`

### Endpoints
  `GET /estado`
  `POST /solicitar`
  `GET /health`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔒 Sí (1 referencias)

### Estados / enums detectados
  - OK
  - WITHDRAWAL_INITIATED

---
## Módulo: `economicGraph`

### Endpoints
  `GET /zone/:zoneId`
  `GET /node/:nodeType/:entityId/neighbors`
  `GET /zone/:zoneId/top`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `events`

### Endpoints
  `POST /`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `evidence`

### Endpoints
  `POST /`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `gatewayRoutes`

### Endpoints
  `GET /metrics`
  `GET /health`
  `POST /process`
  `POST /freeze`
  `POST /unfreeze`
  `POST /shadow`
  `POST /rollback/:ruleId`
  `POST /seed`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `gia`

### Endpoints
  `POST /consulta`
  `DELETE /conversacion/:comercioId`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔒 Sí (1 referencias)

### Estados / enums detectados

---
## Módulo: `giaRoutes`

### Endpoints
  `GET /health`
  `GET /priority`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔒 Sí (1 referencias)

### Estados / enums detectados

---
## Módulo: `health`

### Endpoints
  `GET /`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados
  - CRITICAL
  - DEGRADED
  - DOWN
  - HEALTHY
  - UNKNOWN
  - UP

---
## Módulo: `merchantRoutes`

### Endpoints
  `GET /health`
  `GET /profile`
  `POST /profile`
  `PATCH /profile`
  `GET /dashboard`
  `GET /catalog`
  `POST /catalog`
  `PATCH /catalog/:itemId`
  `DELETE /catalog/:itemId`
  `GET /analytics`
  `POST /admin/reconstruct`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔒 Sí (1 referencias)

### Estados / enums detectados

---
## Módulo: `policyRoutes`

### Endpoints
  `GET /`
  `POST /`
  `POST /:ruleId/activate`
  `POST /:ruleId/rollback`
  `POST /:ruleId/freeze`
  `POST /evaluate`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `quotes`

### Endpoints
  `POST /`
  `POST /:id/send`
  `PATCH /:id`
  `POST /:id/withdraw`
  `POST /:id/select`
  `POST /:id/expire`
  `GET /:id`
  `GET /by-request/:requestId`
  `GET /auction-outcome/:requestId`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔒 Sí (10 referencias)

### Estados / enums detectados

---
## Módulo: `rtmilStatus`

### Endpoints
  `GET /status`
  `POST /aladin/run`
  `GET /ode`
  `POST /ode/aggregate`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `simulationRoutes`

### Endpoints
  `POST /test`
  `POST /replay`
  `GET /drift`
  `POST /drift`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

---
## Módulo: `sync`

### Endpoints
  `POST /command`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados
  - already_processed
  - processed

---
## Módulo: `track`

### Endpoints
  `POST /`

### Eventos que emite
  (ninguno directo)

### Auth requerida
  🔓 No detectada

### Estados / enums detectados

