# SERVIRED — SUMMARY PARA DISEÑO DE FRONTEND
> 2026-06-28 20:06

## Archivos de rutas encontrados
  - activity.js
  - boost.js
  - catalogo.js
  - cobroRoutes.js
  - economicGraph.js
  - events.js
  - evidence.js
  - gatewayRoutes.js
  - gia.js
  - giaRoutes.js
  - health.js
  - merchantRoutes.js
  - policyRoutes.js
  - quotes.js
  - rtmilStatus.js
  - simulationRoutes.js
  - sync.js
  - track.js

## Total de endpoints
   69

## Todos los eventos emitidos en el sistema
  - `FAULT_INJECTED`
  - `JOB_ASSIGNED`
  - `JOB_COMPLETED`
  - `JOB_CREATED`
  - `JOB_PAID`
  - `JOB_STARTED`
  - `chaos`
  - `circuit`
  - `circuit_reset`
  - `desconocida`
  - `email`
  - `email_down`
  - `groq`
  - `groq_latency`
  - `job`
  - `outbox`
  - `outbox_flood`
  - `recovery_test`

## Modelos de datos
  - ActivityLog.js
  - AuctionOutcome.js
  - BusinessProfile.js
  - CatalogItem.js
  - CatalogoItem.js
  - Event.js
  - GiaConversation.js
  - IdempotencyRecord.js
  - MarketingEvent.js
  - MerchantProjection.js
  - Pedido.js
  - PolicyRule.js
  - Quote.js
  - TemporalAssuranceState.js
  - Usuario.js
  - WalEventArchive.js
  - ZoneMetrics.js
  - worker.model.js

## Variables de entorno en uso
  - `ALADIN_SIGNING_SECRET`
  - `ANALYTICS_KEY`
  - `BASE_URL`
  - `BIG_MAC_ARS`
  - `BUSINESS_TIMEZONE`
  - `CONTEXT_DEBUG`
  - `COST_PER_KM_ARS`
  - `DATABASE_URL`
  - `DISPATCH_ENGINE_VERSION`
  - `DIXIE_MODE`
  - `DRY_RUN`
  - `GEMINI_API_KEY`
  - `GLOBULO_ROJO_VERSION`
  - `GMAIL_PASS`
  - `GMAIL_USER`
  - `GOOGLE_CLIENT_ID`
  - `GROQ_API_KEY`
  - `HOME`
  - `IDEM_DRIVER`
  - `JWT_SECRET`
  - `LEDGER_DRIVER`
  - `LLM_PROVIDER`
  - `MIN_PROFITABLE_PRICE_ARS`
  - `ML_ACCESS_TOKEN`
  - `ML_CLIENT_ID`
  - `ML_CLIENT_SECRET`
  - `MONGODB_URI`
  - `MONGODB_URL`
  - `MONGO_URI`
  - `MP_ACCESS_TOKEN`
  - `NODE_ENV`
  - `PORT`
  - `POSTGRES_URL`
  - `REDIS_URL`
  - `RENDER_EXTERNAL_URL`
  - `RESEND_API_KEY`
  - `SEP_PORT`
  - `SERVIRED_URL`
  - `SINAPSIS_MODE`
  - `SINAPSIS_PORT`
  - `SINAPSIS_TEST_EMAIL`
  - `STAGING_ENDPOINT`
  - `STREAM_DRIVER`
  - `TAVILY_API_KEY`
  - `UPSTASH_REDIS_URL`
  - `VAPID_EMAIL`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_PUBLIC_KEY`
  - `WEB_CONCURRENCY`
  - `WORKER_GROUP`

## Deuda técnica (TODO/FIXME)
  - controllers/merchantController.js:73 →    const items = await CatalogItem.find({ merchantId: profile._id, ...(estado !== 'TODOS' ? { estado } : {}) })
  - globuloRojo/briones.js:2 →// MÉTODO BRIONES - Automarketing del trabajador
  - public/js/merchant-app.js:185 →      const { items } = await api('GET', '/catalog?estado=TODOS&limit=50');
  - scripts/audit_prices.js:26 →if (fail === 0) console.log("✅ ALADDIN AUDITADO - TODOS LOS PRECIOS CORRECTOS");
  - src/core/services/financeEngine.js:281 →    // Balance global de TODOS los asientos debe ser 0
  - test-e2e.js:125 →    console.log('🎉 TODOS LOS TESTS PASARON — ServiRed operacionaln');
