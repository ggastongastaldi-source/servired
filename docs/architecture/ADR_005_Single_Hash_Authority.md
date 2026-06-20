# ADR-005 — Single Hash Authority Enforcement

status: ACCEPTED
date: 2026-06-20
relates_to: shared/events/persistenceAdapters/sinapsisBusAdapter.js, src/sinapsis/logManagerV2.js

## Contexto

Una propuesta externa ("SuperIntelligence Control Plane v1.0") describio
un kernel determinista (Arbiter) con EventStore binario propio, single
writer garantizado y replay en 3 modos. Una auditoria comparativa contra
el codigo real de SINAPSIS encontro que sinapsisBusAdapter.js ya
implementa el mismo concepto: hash-chain SHA-256, secuencia atomica via
Mongo, mutex in-process (writeChain), y verificacion de integridad via
busReplay().

## Decision

No se construye un Arbiter nuevo ni un EventStore binario separado.
sinapsisBusAdapter.js es la implementacion vigente del concepto de
Single Writer / Event Ledger para SINAPSIS.

La garantia de integridad de la hash-chain depende hoy de una
restriccion operativa, no de un mecanismo distribuido: ejecucion
monoproceso (WEB_CONCURRENCY=1, node server.js, sin cluster activo).
Esto se confirmo como el estado real de produccion en Render.

## Consecuencias

- WEB_CONCURRENCY=1 queda documentado como restriccion constitucional,
  no como detalle de configuracion incidental.
- Cualquier cambio futuro de infraestructura que introduzca multiples
  procesos (cluster mode de PM2, escalado horizontal en Render, multiples
  dynos) ROMPE la garantia de integridad de la hash-chain sin aviso,
  salvo que se implemente un lock distribuido antes de ese cambio.
- Se agrega un assert defensivo en el arranque del proceso para
  detectar y rechazar configuraciones incompatibles (ver
  src/sinapsis/singleWriterGuard.js).
- Quedan como roadmap valido (evolucionar, no reemplazar):
  Snapshot Layer, Replay formal multi-modo, Compaction Strategy,
  fortalecimiento de idempotencia, auditoria causal derivada.

## Alternativas descartadas

- Arbiter dedicado con EventStore binario propio: descartado, duplica
  funcionalidad existente sin beneficio medible hoy.
- Lock distribuido inmediato: descartado por ahora (YAGNI) - no hay
  necesidad real de escalado horizontal en este momento. Se revisa si
  esa necesidad aparece.
