# SERVIRED — AUDITORÍA FASE IV
Generado: Wed Jul  1 05:56:27 -03 2026

## 1. READ MODELS (Projections)
./controllers/merchantController.js
./models/MerchantProjection.js
./models/BusinessProfile.js
./models/Quote.js
./models/AuctionOutcome.js
./nexus/analytics/replayRunner.js
./nexus/events/emitEvent.js
./nexus/reactive/changeStreamObserver.js
./nexus/reactive/procesarMarketFieldEvent.js
./nexus/reactive/jobRequestedReactor.js
./public/js/merchant-app.js
./routes/economicGraph.js
./routes/merchantRoutes.js
./scripts/replay.js
./server.js
./services/kernelValidator.js
./services/policyEvaluator.js
./services/economicGraphProjection.js
./services/projectionBuilder.js
./services/merchantProjection.js
./services/merchantProjectionReactor.js
./services/giaStateReader.js
./services/gia/tools/AladdinTool.js
./services/quote/quoteService.js
./services/marketField/marketFieldEngine.js
./shared/events/router-instance.js
./shared/projections/rollingPriceBaseline.js
./shared/reactors/auctionOutcomeProjection.js
./shared/reactors/aladdinIntelligenceReactor.js
./sinapsis/projections/engine.js
./src/core/routes/admin.js
./src/dispatch/services/ProjectionWorker.js

## 2. ENDPOINTS ADMINISTRATIVOS
./public/admin-referidos.html
./public/admin.html
./src/core/routes/admin.js
./src/core/routes/adminFinance.js
./src/core/routes/referidosAdmin.js
--- rutas con /admin en routes/ ---
routes/merchantRoutes.js:27:router.post('/admin/reconstruct', auth, async (req, res) => {

## 3. DASHBOARDS EN public/
./public/admin-referidos.html
./public/admin.html
./public/b19.html
./public/cliente.html
./public/debug-storage.html
./public/googleff0bbd6fd2383dfc.html
./public/index.html
./public/redir.html
./public/reset-debora.html
./public/trabajador.html
./public/boost-success.html
./public/boost-failure.html
./public/boost-pending.html
./public/comercio.html
./public/gia-home.html
./public/pulse.html
--- posibles dashboards (pulse, dashboard, panel, command, center) ---
./public/js/localCommandQueue.js
./public/pulse.html
./services/gia/tools/PulseTool.js
./sockets
./sockets/worker.handler.js
./src/core/commands
./src/core/commands/emergencyBroadcast.js
./src/core/core/commandRunner.js
./src/core/services/mensajeriaSocket.js
./src/core/services/socketHandlers.js
./src/core/services/socketHandlers.js.gia-bak
./patch_socket_fanout_fix.js
./patch_socket_runtime_fanout_fix.js
./patch_activate_socket_runtime.js
./fix_final_socket_runtime.js
./audit_runtime_socket.js
./FIX_SOCKET_SERVER_CLOSED_LOOP.js
./FIX_SOCKET_STATE_LOCK.js
./FIX_SOCKET_MONGO_STATE.js

## 4. REACTORS EXISTENTES
./models/MerchantProjection.js
./models/BusinessProfile.js
./nexus/reactive/changeStreamObserver.js
./nexus/reactive/procesarMarketFieldEvent.js
./nexus/reactive/jobRequestedReactor.js
./routes/merchantRoutes.js
./server.js
./services/merchantProjection.js
./services/merchantProjectionReactor.js
./services/quote/quoteService.js
./shared/events/router-instance.js
./shared/reactors/trustDecayReactor.js
./shared/reactors/auctionOutcomeProjection.js
./shared/reactors/aladdinIntelligenceReactor.js
--- registro de reactors (busco 'Reactor Layer' o 'registerReactor') ---
./shared/events/router-instance.js:32:// Reactor Layer V1
./shared/events/router-instance.js:35:// Reactor Layer V2 — TrustDecay
./shared/events/router-instance.js:38:// Reactor Layer V3 — AuctionOutcome (CQRS)
./shared/events/router-instance.js:41:// Reactor Layer V4 — Aladdin Intelligence (ADR-001/003: read-only sobre estado territorial)

## 5. PROJECTIONS EXISTENTES
./models/MerchantProjection.js
./services/economicGraphProjection.js
./services/projectionBuilder.js
./services/merchantProjection.js
./services/merchantProjectionReactor.js
./services/marketField/marketFieldProjection.js
./shared/projections
./shared/reactors/auctionOutcomeProjection.js
./sinapsis/projections
./src/dispatch/services/ProjectionWorker.js

## 6. MÉTRICAS / OBSERVABILIDAD YA CALCULADAS
./models/worker.model.js
./nexus/application/chaosLab.js
./nexus/reactive/changeStreamObserver.js
./nexus/reactive/procesarMarketFieldEvent.js
./nexus/reactive/jobRequestedReactor.js
./public/gr3_client_block.js
./routes/health.js
./rtgBridge.js
./services/marketField/marketFieldProjection.js
./services/marketField/marketFieldEngine.js
./shared/observers/priceAnomalyObserver.js
./shared/reactors/aladdinIntelligenceReactor.js
./sockets/worker.handler.js
./src/dispatch/intelligence/index.js
./src/dispatch/services/DispatchService.js
./src/dispatch/services/ETAProvider.js
./src/dispatch/services/MetricsService.js
./src/dispatch/services/ScoringEngine.js
./src/engine/eventEngine.js
./src/engine/paymentRoutes.js
./src/rtg/dist/AnalyticsService.js
./src/rtg/dist/ControlLoop.js
./src/rtg/dist/index.js
./src/rtg/dist/shadow/ServiRedAdapter.js
./src/rtg/dist/shadow/ShadowMonitor.js
./src/sinapsis/auditMode.js
./src/sinapsis/dixieGate.js
./src/sinapsis/logManager.js
./src/sinapsis/logManagerV2.js
./src/sinapsis/policyEngine.js
./test-logv2.js
./runtime/services/AnalyticsService.js
./runtime/services/ObserverService.js
./runtime/index.js

## 7. EVENT SCHEMA (tipos de eventos registrados)
./shared/events/event.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://servired.online/schemas/event.schema.json",
  "title": "ServiRed OS - Canonical Event",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "event_id",
    "event_type",
    "timestamp",
    "correlation_id",
    "causation",
    "actor",
    "context",
    "payload",
    "metadata"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    },
    "event_type": {
      "type": "string",
      "enum": [
        "qr_scanned",
        "landing_viewed",
        "shell_opened",
        "register_started",
        "register_completed",
        "case_created",
        "case_abandoned",
        "job_requested",
        "job_completed",
        "job_unfulfilled",
        "wallet_opened",
        "lead_attributed",
        "PRICE_SUBMITTED",
        "AnomalyDetected",
        "ActorTrustUpdated",
        "ActorInfluenceReduced",
        "QUOTE_CREATED",
        "QUOTE_SENT",
        "QUOTE_UPDATED",
        "QUOTE_EXPIRED",
        "QUOTE_WITHDRAWN",
        "QUOTE_SELECTED",
        "AladdinInsightGenerated",
        "AuctionOutcomeProjected"
      ]
    },
    "timestamp": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$"
    },
    "correlation_id": {
      "type": "string",
      "minLength": 1
    },
    "causation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "event_id",
        "event_type"
      ],
      "properties": {
        "event_id": {
          "type": [
            "string",
            "null"
          ]
        },
        "event_type": {
          "type": [
            "string",
            "null"
          ]
        }
      }
    },
    "actor": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "user_id",
        "role"
      ],
      "properties": {
        "user_id": {
          "type": [
            "string",
            "null"
          ]
        },
        "role": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "context": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "session_id",
        "zone",
        "source"
      ],
      "properties": {
        "tenant_id": {
          "type": "string",
          "minLength": 1
        },
        "session_id": {
          "type": [
            "string",
            "null"
          ]
        },
        "zone": {
          "type": [
            "string",
            "null"
          ]
        },
        "source": {
          "type": [
            "string",
            "null"
          ]
        }
      }
    },
    "payload": {
      "type": "object"
    },
    "metadata": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "version",
        "environment"
      ],
      "properties": {
        "version": {
          "type": "integer",
          "minimum": 1
        },
        "environment": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  }
}

## 8. ESTRUCTURA GENERAL (2 niveles)
.
./.git
./.git/hooks
./.git/info
./.git/objects
./.git/refs
./.git/logs
./config
./controllers
./docs
./docs/architecture
./docs/audits
./docs/examples
./docs/tickets
./docs/specs
./globuloRojo
./globuloRojo/leadEngine
./middleware
./models
./nexus
./nexus/analytics
./nexus/application
./nexus/bootstrap
./nexus/dixie
./nexus/events
./nexus/eventstore
./nexus/infrastructure
./nexus/reactive
./nexus/shadow
./nexus/shared
./public
./public/assets
./public/js
./routes
./scripts
./seeds
./services
./services/chaosLab
./services/gia
./services/quote
./services/marketField
./shared
./shared/events
./shared/observers
./shared/projections
./shared/reactors
./shared/catalogs
./sinapsis
./sinapsis/adapters
./sinapsis/execution
./sinapsis/policies
./sinapsis/projections
./sockets
./src
./src/api
./src/config
./src/contracts
./src/core
./src/dispatch
./src/dixiegate
./src/engine
./src/events
./src/models
./src/responses
./src/routes
./src/rtg
./src/sep
./src/services
./src/sinapsis
./tests-e2e
./tests
./tests/events
./tests/frontend
./utils
./constants
./wal_segments
./wal_segments/spill
./audit
./runtime
./runtime/services
./runtime/middleware

## 9. POSIBLES DUPLICADOS (mismo nombre de archivo en distintas carpetas)
AnalyticsService.js
LeadEscalated.js
LeadQualified.js
LeadRejected.js
MarketingEvent.js
Pedido.js
Usuario.js
aladdinEngine.js
auth.js
catalogo.js
circuitBreaker.js
dixieGate.js
emitEvent.js
engine.js
gia.js
index.js
policyEngine.js
policyEvaluator.js

## 10. TRUST/RISK/KYC (insumos para Fase 3 Centinela, solo detección)
./services/chaosLab/metrics/collector.js
./shared/events/router-instance.js
./shared/reactors/trustDecayReactor.js
./constants/eventTaxonomy.js
