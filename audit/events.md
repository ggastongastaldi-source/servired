# EVENTOS — emitidos y consumidos
> 2026-06-28 20:06

## Emitidos
| Evento | Archivo | Línea |
|--------|---------|-------|
| `chaos` | nexus/application/chaosLab.js | 20 |
| `chaos` | nexus/application/chaosLab.js | 28 |
| `chaos` | nexus/application/chaosLab.js | 47 |
| `chaos` | nexus/application/chaosLab.js | 72 |
| `chaos` | nexus/application/chaosLab.js | 84 |
| `job` | src/core/services/socketHandlers.js | 283 |
| `job` | src/core/services/socketHandlers.js | 287 |
| `job` | src/core/services/socketHandlers.js | 292 |
| `job` | src/core/services/socketHandlers.js | 500 |
| `job` | test-punta-a-punta.js | 19 |
| `job` | test-punta-a-punta.js | 25 |
| `job` | test-punta-a-punta.js | 31 |
| `job` | test-punta-a-punta.js | 37 |
| `job` | test-punta-a-punta.js | 43 |

## Consumidores (.on / .subscribe)
| Evento | Archivo |
|--------|---------|
| `AnomalyDetected` | services/chaosLab/runner.js |
| `AnomalyDetected` | shared/reactors/trustDecayReactor.js |
| `PRICE_SUBMITTED` | shared/observers/priceAnomalyObserver.js |
| `PRICE_SUBMITTED` | shared/reactors/trustDecayReactor.js |
| `QUOTE_SELECTED` | shared/reactors/auctionOutcomeProjection.js |
| `accept_offer` | src/dispatch/acceptOfferHandler.js |
| `aceptar_trabajo` | src/core/services/fixes/gps-manager.js |
| `aceptar_trabajo` | src/core/services/socketHandlers.js |
| `admin_conectado` | src/core/services/socketHandlers.js |
| `cambiar_estado_pedido` | src/core/services/socketHandlers.js |
| `cambiar_estado` | src/core/services/socketHandlers.js |
| `cancelar_pedido` | src/core/services/socketHandlers.js |
| `change` | nexus/reactive/changeStreamObserver.js |
| `change` | sinapsis/projections/engine.js |
| `cliente_conectado` | src/core/services/socketHandlers.js |
| `close` | nexus/reactive/changeStreamObserver.js |
| `connect_error` | simulador_gps_node.js |
| `connect` | public/gr3_client_block.js |
| `connect` | simulador_gps_node.js |
| `connect` | worker_bot.js |
| `connection` | src/core/services/fixes/gps-manager.js |
| `connection` | src/core/services/fixes/loop-guard.js |
| `connection` | src/core/services/mensajeriaSocket.js |
| `connection` | src/core/services/socketHandlers.js |
| `connection` | src/dispatch/index.js |
| `data` | scripts/chaos-staging.js |
| `data` | scripts/e2e-test.js |
| `data` | scripts/stress_test.js |
| `data` | src/sep/gateway.js |
| `data` | src/sinapsis/index.js |
| `data` | test-sinapsis-events.js |
| `data` | test-sinapsis-full.js |
| `data` | tests-e2e/e2e.spec.js |
| `disconnect` | public/gr3_client_block.js |
| `disconnect` | sockets/worker.handler.js |
| `disconnect` | src/core/services/fixes/gps-manager.js |
| `disconnect` | src/core/services/mensajeriaSocket.js |
| `disconnect` | src/core/services/socketHandlers.js |
| `disconnect` | worker_bot.js |
| `end` | scripts/chaos-staging.js |
| `end` | scripts/e2e-test.js |
| `end` | scripts/stress_test.js |
| `end` | src/sep/gateway.js |
| `end` | src/sinapsis/index.js |
| `end` | test-sinapsis-events.js |
| `end` | test-sinapsis-full.js |
| `end` | tests-e2e/e2e.spec.js |
| `error` | nexus/reactive/changeStreamObserver.js |
| `error` | scripts/chaos-staging.js |
| `error` | scripts/e2e-test.js |
| `error` | scripts/stress_test.js |
| `error` | server.js |
| `error` | sinapsis/projections/engine.js |
| `error` | src/dispatch/config.js |
| `error` | src/sep/gateway.js |
| `error` | src/sinapsis/index.js |
| `error` | test-sinapsis-events.js |
| `error` | test-sinapsis-full.js |
| `error` | tests-e2e/e2e.spec.js |
| `event` | src/sinapsis/eye.js |
| `failed` | src/dispatch/queues/dispatchQueue.js |
| `failed` | src/dispatch/queues/ttlQueue.js |
| `freeze_dispatch` | services/gatewayListeners.js |
| `gateway_error` | services/gatewayListeners.js |
| `global_freeze_activated` | services/gatewayListeners.js |
| `global_freeze_lifted` | services/gatewayListeners.js |
| `gps_update` | src/core/services/socketHandlers.js |
| `join_room` | src/core/services/socketHandlers.js |
| `nueva_oportunidad` | worker_bot.js |
| `nuevo_pedido` | src/core/services/socketHandlers.js |
| `registrar_pedido` | src/core/services/fixes/loop-guard.js |
| `registrar_pedido` | src/core/services/socketHandlers.js |
| `shadow_decision` | services/gatewayListeners.js |
| `timeline_mensaje` | src/core/services/socketHandlers.js |
| `timeout` | scripts/chaos-staging.js |
| `timeout` | scripts/e2e-test.js |
| `trabajo_completado` | src/core/services/fixes/gps-manager.js |
| `trabajo_completado` | src/core/services/fixes/loop-guard.js |
| `trabajo_completado` | src/core/services/socketHandlers.js |
| `worker_conectado` | src/core/services/fixes/gps-manager.js |
| `worker_conectado` | src/core/services/socketHandlers.js |
| `worker_update` | public/js/fleet.js |

## Eventos sin consumidor (huérfanos)
  ⚠ `FAULT_INJECTED`
  ⚠ `JOB_ASSIGNED`
  ⚠ `JOB_COMPLETED`
  ⚠ `JOB_CREATED`
  ⚠ `JOB_PAID`
  ⚠ `JOB_STARTED`
  ⚠ `chaos`
  ⚠ `circuit`
  ⚠ `circuit_reset`
  ⚠ `desconocida`
  ⚠ `email`
  ⚠ `email_down`
  ⚠ `groq`
  ⚠ `groq_latency`
  ⚠ `job`
  ⚠ `outbox`
  ⚠ `outbox_flood`
  ⚠ `recovery_test`
