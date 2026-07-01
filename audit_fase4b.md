# AUDITORÍA FASE IV-B — Grafo de dependencias activas
Generado: Wed Jul  1 05:58:36 -03 2026

## REQUIRES ACTIVOS DESDE server.js
1:require('dotenv').config();
2:const { assertSingleWriter } = require('./src/sinapsis/singleWriterGuard');
3:const rtmil = require('./services/rtmilIngest');
5:const express = require('express');
7:const rutaMensajes = require('./src/core/routes/mensajes');
8:const http = require('http');
9:const { Server } = require('socket.io');
10:const rtgBridge = require('./rtgBridge');
11:const mongoose = require('mongoose');
12:const cors = require('cors');
23:require('./src/core/services/socketHandlers')(io);
25:require('./globuloRojo/watchdog').iniciar();
26:require('./scheduledConfirmations').iniciar(io);
27:require('./src/core/services/mensajeriaSocket')(io);
40:const { httpContextMiddleware } = require('./nexus/infrastructure/contextMiddleware');
41:const requestContext = require('./middleware/requestContext');
47:const seoRouter = require('./src/core/routes/seo');
49:const casosRouter = require('./src/core/routes/casos');
51:const sitemapsRouter = require('./src/core/routes/sitemaps');
54:app.use('/api/auth', require('./src/core/routes/auth'));
55:app.use('/api/onboarding/provider', require('./src/core/routes/onboardingRoutes'));
56:const pedidosRoute = require('./src/core/routes/pedidos')(io);
57:app.use('/api/upload', require('./src/core/routes/upload'));
59:const catalogoRoute = require('./routes/catalogo');
61:app.use('/api/leads', require('./src/core/routes/leads'));
62:app.use('/api/admin', require('./src/core/routes/admin'));
63:app.use('/api/matching', require('./src/core/routes/matching'));
64:app.use('/api/asistente', require('./src/core/routes/asistente'));
65:app.use('/api/rating', require('./src/core/routes/rating'));
66:app.use('/api/activity', require('./routes/activity'));
67:app.use('/api/pagos', require('./src/core/routes/pagos'));
68:app.use('/api/admin/finance', require('./src/core/routes/adminFinance'));
69:app.use('/api/sinapsis/dixie', require('./src/core/routes/dixieTerminal'));
70:app.use('/api/admin/referidos', require('./src/core/routes/referidosAdmin'));
71:app.use('/api/payment', require('./src/engine/paymentRoutes'));
72:const gatewayRoutes = require('./routes/gatewayRoutes');
73:const merchantRoutes = require('./routes/merchantRoutes');
74:const giaRoutes = require('./routes/giaRoutes');
75:const cobroRoutes = require('./routes/cobroRoutes');
76:const { procesarEvento: merchantReactorHandle } = require('./services/merchantProjectionReactor');
77:const simulationRoutes = require('./routes/simulationRoutes');
78:const policyRoutes = require('./routes/policyRoutes');
79:require('./services/gatewayListeners');
83:  app.post('/api/admin/broadcast', require('./src/core/commands/emergencyBroadcast').emergencyBroadcast);
84:app.use('/api/commerce', require('./src/core/routes/commerce'));
85:app.use('/api/smart-quote', require('./src/core/routes/smartQuote'));
86:app.use('/api/finanzas', require('./src/core/routes/finanzas'));
116:  const html = require("fs").readFileSync(require("path").join(__dirname, "public/index.html"), "utf8");
154:app.use('/api/health', require('./routes/health'));
155:app.use('/api/admin/rtmil', require('./routes/rtmilStatus'));
156:app.use('/api/sync', require('./routes/sync'));
172:const { assertSystemUsers } = require('./utils/assertSystemUsers');
189:require('./services/boostExpiry').startBoostExpiryCron();
192:    require('./src/core/services/financeWatchdog').iniciar();
194:    const { scan: dixieScan } = require('./src/sinapsis/dixieTerminal/dixieScanner');
200:    require('./src/dispatch').initDispatchEngine(io).catch(e => console.error('[DispatchEngine] init error:', e.message));
201:    const { init: initJobReactor } = require('./nexus/reactive/jobRequestedReactor');
206:      const { router: quoteEventRouter } = require('./shared/events/router-instance');
207:      const auctionOutcomeProjection = require('./shared/reactors/auctionOutcomeProjection');
212:      const { initNexus } = require('./nexus/initNexus');
223:const runtime = require('./runtime');
243:const cron = require('node-cron');
244:const { ejecutarCicloAladin } = require('./src/core/services/priceWorker');
252:const TemporalAssuranceState = require('./models/TemporalAssuranceState');
431:    const { reconcileAllProviders } = require('./src/core/services/providerStateReconciliator');
447:const presupuestoCtrl = require('./controllers/presupuestoController');
454:    const { getHealth } = require('./src/sinapsis/logManagerV2');
455:    const { runCrashRecovery } = require('./src/sinapsis/crashRecovery');
468:const https = require('https');
482:const eventsRouter = require('./routes/events');
486:const { startProjectionEngine } = require('./sinapsis/projections/engine');
490:const evidenceRouter = require('./routes/evidence');
492:app.use('/api/referidos', require('./src/routes/referidos'));
493:app.use('/api/shell', require('./src/routes/shellEvents'));
494:app.use('/api/boost', require('./routes/boost'));
495:app.use('/api/graph', require('./routes/economicGraph'));
496:app.use('/api/track', require('./routes/track'));
497:app.use('/api/analytics', require('./src/core/routes/analytics'));
498:app.use('/api/quotes',   require('./routes/quotes'));
499:app.use('/api/jobs',     require('./routes/jobs'));
500:app.use('/api/zones', require('./routes/zones'));
504:const { soloAdmin } = require('./src/core/middleware/auth');
535:    const { reconcileAllProviders } = require('./src/core/services/providerStateReconciliator');
575:const { handleSocketEvents } = require('./src/core/services/socketHandlers');
594:const { eventEngine } = require('./src/engine/eventEngine');
595:const dispatch = require('./src/dispatch');

## REQUIRES ACTIVOS DESDE runtime/index.js
2:const bus      = require('./EventBus');
3:const registry = require('./ServiceRegistry');
4:const eventLogger = require('./middleware/eventLogger');
5:const NotificationService = require('./services/NotificationService');
6:const AnalyticsService = require('./services/AnalyticsService');
7:const ObserverService = require('./services/ObserverService');

## src/core/routes/admin.js — ¿está montado en server.js?
62:app.use('/api/admin', require('./src/core/routes/admin'));
68:app.use('/api/admin/finance', require('./src/core/routes/adminFinance'));
70:app.use('/api/admin/referidos', require('./src/core/routes/referidosAdmin'));
83:  app.post('/api/admin/broadcast', require('./src/core/commands/emergencyBroadcast').emergencyBroadcast);
155:app.use('/api/admin/rtmil', require('./routes/rtmilStatus'));
502:// B19 Control Plane — solo admin
526:// En modo manual: reconstruirTodos() disponible en /api/merchant/admin/reconstruct
533:app.get('/api/admin/reconcile', async (req, res) => {

## AnalyticsService.js
--- ubicaciones ---
./src/core/services/analyticsService.js
./src/rtg/dist/AnalyticsService.js
./runtime/services/AnalyticsService.js
--- referenciado por (quién lo requiere) ---
./rtgBridge.js:14:    const { AnalyticsService } = require('./src/rtg/dist/AnalyticsService');
./src/rtg/dist/index.js:6:const AnalyticsService_1 = require("./AnalyticsService");
./src/rtg/dist/shadow/ShadowMonitor.js:40:const AnalyticsService_1 = require("../AnalyticsService");
./runtime/index.js:6:const AnalyticsService = require('./services/AnalyticsService');

## dixieGate.js
--- ubicaciones ---
./nexus/shared/dixieGate.js
./src/sinapsis/dixieGate.js
--- referenciado por (quién lo requiere) ---

## policyEngine.js
--- ubicaciones ---
./services/policyEngine.js
./src/sinapsis/dixieTerminal/policyEngine.js
./src/sinapsis/policyEngine.js
--- referenciado por (quién lo requiere) ---
./routes/gatewayRoutes.js:11:const policyEngine = require('../services/policyEngine');
./routes/policyRoutes.js:8:const pe = require('../services/policyEngine');
./seeds/seedPolicies.js:9:const policyEngine = require('../services/policyEngine');
./services/controlPlaneGateway.js:22:const policyEngine = require('./policyEngine');
./src/sinapsis/auditMode.js:5:const { evaluate } = require('./policyEngine');
./src/sinapsis/dixieGate.js:5:const { evaluate } = require('./policyEngine');
./src/sinapsis/dixieTerminal/dixieScanner.js:8:const { evaluate }       = require('./policyEngine');

## policyEvaluator.js
--- ubicaciones ---
./services/policyEvaluator.js
./src/core/services/policyEvaluator.js
--- referenciado por (quién lo requiere) ---
./services/controlPlaneGateway.js:19:const { buildContext: _buildCtx, evaluateRules } = require('./policyEvaluator');
./services/kernelValidator.js:20:const { TraceStatus, EffectType } = require('./policyEvaluator');
./services/policySimulationEngine.js:14:const { buildContext, evaluateRules } = require('./policyEvaluator');

## engine.js
--- ubicaciones ---
./sinapsis/execution/engine.js
./sinapsis/policies/engine.js
./sinapsis/projections/engine.js
--- referenciado por (quién lo requiere) ---
./server.js:486:const { startProjectionEngine } = require('./sinapsis/projections/engine');
./sinapsis/projections/engine.js:2:const { evaluate } = require('../policies/engine');
./sinapsis/projections/engine.js:3:const { execute }  = require('../execution/engine');

## emitEvent.js
--- ubicaciones ---
./nexus/events/emitEvent.js
./nexus/eventstore/emitEvent.js
--- referenciado por (quién lo requiere) ---
./nexus/application/auctionEngine.js:5:const { emitEvent } = require('../events/emitEvent');
./nexus/application/chaosLab.js:5:const { emitEvent } = require('../events/emitEvent');
./nexus/application/claudeAuditor.js:6:const { emitEvent } = require('../events/emitEvent');
./nexus/application/governanceLayer.js:5:const { emitEvent } = require('../events/emitEvent');
./nexus/application/narrativeObserver.js:5:const { emitEvent } = require('../events/emitEvent');
./nexus/application/workflowEngine.js:7:const { emitEvent } = require('../events/emitEvent');
./nexus/infrastructure/circuitBreaker.js:103:    const { emitEvent } = require('../events/emitEvent');
./nexus/infrastructure/contextMiddleware.js:6:const { runWithContext, startCorrelation } = require('../events/emitEvent');
./routes/health.js:121:    const { emitEvent } = require('../nexus/events/emitEvent');
./routes/health.js:130:    const nexusModule = require('../nexus/events/emitEvent');
./routes/health.js:148:    const evModule = require('../nexus/events/emitEvent');
./routes/jobs.js:15:const emitEvent       = require('../nexus/events/emitEvent');
./services/marketField/marketFieldReactor.js:1:const { emitEvent } = require('../../nexus/events/emitEvent');
./src/core/controllers/notificationController.js:168:      const { emitEvent: _emitFallback } = require('../../../nexus/events/emitEvent');
./src/core/services/financeEngine.js:14:    const { emitEvent } = require('../../../nexus/events/emitEvent');
./src/core/services/socketHandlers.js:2:const { emitEvent } = require('../../../nexus/events/emitEvent');
./test-punta-a-punta.js:9:  const { emitEvent } = require('./nexus/events/emitEvent');

## catalogo.js
--- ubicaciones ---
./public/catalogo.js
./routes/catalogo.js
--- referenciado por (quién lo requiere) ---
./scripts/audit_prices.js:1:const { CATALOGO } = require("../public/catalogo.js");
./server.js:59:const catalogoRoute = require('./routes/catalogo');
./src/core/aladdin/aladdinEngine.js:3:const { CATALOGO } = require('../../../public/catalogo.js');

## circuitBreaker.js
--- ubicaciones ---
./nexus/infrastructure/circuitBreaker.js
./src/sinapsis/dixieTerminal/circuitBreaker.js
--- referenciado por (quién lo requiere) ---
./nexus/application/chaosLab.js:6:const { recordFailure, recordSuccess, getAll } = require('../infrastructure/circuitBreaker');
./nexus/application/governanceLayer.js:6:const { STATES, recordFailure, recordSuccess, getState } = require('../infrastructure/circuitBreaker');
./nexus/application/governanceLayer.js:65:    const { getAll } = require('../infrastructure/circuitBreaker');
./nexus/infrastructure/outboxDispatcher.js:2:const { execute: circuitBreaker } = require('./circuitBreaker');
./nexus/initNexus.js:22:  const { setOnOpenHook } = require('./infrastructure/circuitBreaker');
./nexus/initNexus.js:36:  const { getState } = require('./infrastructure/circuitBreaker');
./src/core/routes/admin.js:116:    const { getAll } = require('../../../nexus/infrastructure/circuitBreaker');
./src/core/services/groqService.js:11:    const { execute } = require('../../../nexus/infrastructure/circuitBreaker');
./src/sinapsis/dixieTerminal/__tests__/circuitBreaker.harness.js:36:// Interceptar el require('./PolicyFinding') que hace circuitBreaker.js
./src/sinapsis/dixieTerminal/__tests__/circuitBreaker.harness.js:45:const { evaluateCircuitBreaker } = require('../circuitBreaker');
./src/sinapsis/dixieTerminal/dixieScanner.js:10:const { evaluateCircuitBreaker } = require('./circuitBreaker');

## auth.js
--- ubicaciones ---
./src/core/middleware/auth.js
./src/core/routes/auth.js
--- referenciado por (quién lo requiere) ---
./middleware/authMiddleware.js:10:const { verificarToken } = require('../src/core/middleware/auth');
./routes/gatewayRoutes.js:9:const { soloAdmin } = require('../src/core/middleware/auth');
./routes/policyRoutes.js:7:const { soloAdmin } = require('../src/core/middleware/auth');
./routes/simulationRoutes.js:9:const { soloAdmin } = require('../src/core/middleware/auth');
./routes/sync.js:5:const { verificarToken } = require('../src/core/middleware/auth');
./routes/boost.js:5:const { verificarToken } = require('../src/core/middleware/auth');
./routes/quotes.js:35:  requireAuth = require("../src/core/middleware/auth").verificarToken;
./server.js:54:app.use('/api/auth', require('./src/core/routes/auth'));
./server.js:504:const { soloAdmin } = require('./src/core/middleware/auth');
./src/core/routes/adminFinance.js:3:const { verificarToken, soloAdmin } = require('../middleware/auth');
./src/core/routes/dixieTerminal.js:10:const { verificarToken, soloAdmin } = require('../middleware/auth');
./src/core/routes/finanzas.js:4:const { verificarToken, verificarRol } = require('../middleware/auth');
./src/core/routes/mensajes.js:4:const { verificarToken } = require('../middleware/auth');
./src/core/routes/pagos.js:9:const { verificarToken } = require('../middleware/auth');
./src/core/routes/pedidos.js:42:const { verificarToken, verificarRol } = require('../middleware/auth');
./src/core/routes/rating.js:3:const { verificarToken } = require('../middleware/auth');
./src/core/routes/upload.js:6:const { verificarToken } = require('../middleware/auth');
./patch_provider_pipeline.js:154:    "app.use('/api/auth', require('./src/core/routes/auth'));",
./patch_provider_pipeline.js:155:    "app.use('/api/auth', require('./src/core/routes/auth'));\napp.use('/api/onboarding/provider', require('./src/core/routes/onboardingRoutes'));"

## gia.js
--- ubicaciones ---
./gia.js
./routes/gia.js
--- referenciado por (quién lo requiere) ---

## aladdinEngine.js
--- ubicaciones ---
./src/core/aladdin/aladdinEngine.js
./src/core/services/aladdinEngine.js
--- referenciado por (quién lo requiere) ---
./scripts/audit_prices.js:2:const { calcular } = require("../services/aladdinEngine");
./src/api/priceController.js:2:const { calcular, listarRubros } = require('../core/aladdin/aladdinEngine');
./src/core/controllers/matchingController.js:2:const aladdin = require('../services/aladdinEngine');
./src/core/routes/pedidos.js:94:      const aladdin = require('../services/aladdinEngine');
./src/core/services/aladdinEngine.js:2:module.exports = require('../aladdin/aladdinEngine');

## DIFF de duplicados (si hay exactamente 2 ubicaciones)

--- diff dixieGate.js ---
1,10c1,2
< // DIXIE GATE — Frontera de normalización ServiRed Nexus
< // Todo ID pasa por acá o no entra al sistema
< const mongoose = require('mongoose');
< 
< function toObjectId(value, campo = 'id') {
<   if (!value) throw new Error(`[DixieGate] ${campo} es requerido`);
<   if (value instanceof mongoose.Types.ObjectId) return value;
<   if (!mongoose.Types.ObjectId.isValid(value)) throw new Error(`[DixieGate] ${campo} inválido: ${value}`);
<   return new mongoose.Types.ObjectId(value);
< }
---
> // SINAPSIS DixieGate v1.0
> // Ingesta, evaluación y ejecución controlada de eventos
12,16c4,6
< function safeString(value, campo = 'campo', maxLen = 500) {
<   if (value === null || value === undefined) return '';
<   const s = String(value).trim().slice(0, maxLen);
<   return s;
< }
---
> const { createEvent, validateEvent } = require('./eventSchema');
> const { evaluate } = require('./policyEngine');
> const { seal } = require('./logManager');
18,23c8,9
< function normalizeZona(zona) {
<   if (!zona) return 'desconocida';
<   return String(zona).toLowerCase().trim()
<     .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
<     .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
< }
---
> async function ingest(type, payload = {}, metadata = {}, executor = null) {
>   const t0 = Date.now();
25,32c11,12
< function validatePayload(payload, required = []) {
<   const errores = [];
<   for (const campo of required) {
<     if (!payload[campo]) errores.push(`${campo} es requerido`);
<   }
<   if (errores.length) throw new Error('[DixieGate] Payload inválido: ' + errores.join(', '));
<   return true;
< }
---
>   // 1. Crear evento SINAPSIS
>   const event = createEvent(type, payload, metadata);
34,36c14,25
< // Middleware Express — rechaza IDs malformados temprano
< function dixieMiddleware(campos = []) {
<   return (req, res, next) => {
---
>   // 2. Validar contrato
>   validateEvent(event);
> 
>   // 3. Evaluar política
>   const decision = evaluate(event);
> 
>   // 4. Sellar en LogManager (memoria inmutable)
>   await seal(event, decision);
> 
>   // 5. Ejecutar si corresponde
>   let executionResult = null;
>   if (decision.decision === 'EXECUTE' && executor) {
38,44c27,39
<       for (const campo of campos) {
<         const val = req.params[campo] || req.body[campo];
<         if (val) toObjectId(val, campo);
<       }
<       next();
<     } catch(e) {
<       res.status(400).json({ ok: false, error: e.message });
---
>       executionResult = await executor(event, decision);
>       console.log(JSON.stringify({
>         level: 'info', source: 'DIXIE_GATE',
>         eventId: event.eventId, type, decision: 'EXECUTED',
>         latencyMs: Date.now() - t0
>       }));
>     } catch (err) {
>       console.error(JSON.stringify({
>         level: 'error', source: 'DIXIE_GATE',
>         eventId: event.eventId, type, error: err.message,
>         latencyMs: Date.now() - t0
>       }));
>       decision.decision = 'FAILED';
46c41,61
<   };
---
>   } else if (decision.decision === 'HOLD') {
>     console.log(JSON.stringify({
>       level: 'warn', source: 'DIXIE_GATE',
>       eventId: event.eventId, type, decision: 'HELD',
>       reason: decision.reason
>     }));
>   } else if (decision.decision === 'ESCALATE') {
>     console.warn(JSON.stringify({
>       level: 'warn', source: 'DIXIE_GATE',
>       eventId: event.eventId, type, decision: 'ESCALATED',
>       risk_score: decision.risk_score, reason: decision.reason
>     }));
>   } else if (decision.decision === 'REJECT') {
>     console.error(JSON.stringify({
>       level: 'error', source: 'DIXIE_GATE',
>       eventId: event.eventId, type, decision: 'REJECTED',
>       reason: decision.reason
>     }));
>   }
> 
>   return { event, decision, executionResult, latencyMs: Date.now() - t0 };
49c64
< module.exports = { toObjectId, safeString, normalizeZona, validatePayload, dixieMiddleware };
---
> module.exports = { ingest };

--- diff policyEvaluator.js ---
2,13c2,4
<  * B19 Policy Evaluator — v3.1 — Contrato effectType en trace
<  *
<  * CAMBIO v3.1:
<  *   Cada entry del trace declara effectType explícito:
<  *     'financial' | 'state' | 'control' | 'side_effect' | 'none'
<  *
<  *   Esto cierra el problema 2.1: π_f y π_s ya no infieren por op name
<  *   sino que filtran por contrato declarado en el entry.
<  *
<  *   A1 — Trace Completeness: todo efecto observable está en trace
<  *   A2 — Projection Determinism: π_f y π_s son funciones puras del trace
<  *   A3 — Context Non-authority: ctx₀ es solo input inicial, nunca fuente de verdad
---
>  * policyEvaluator.js — Aladdín Kernel v2
>  * Event Sourcing / Proyección pura
>  * INVARIANTE: δ solo muta priceCents + trace. breakdown = π_f(trace)
15d5
< 
18,66c8,9
< // ─────────────────────────────────────────────────────────────────────────────
< // ENUMS
< // ─────────────────────────────────────────────────────────────────────────────
< 
< const TraceStatus = Object.freeze({
<   EXECUTED:       'EXECUTED',
<   NOOP:           'NOOP',
<   SKIPPED_FREEZE: 'SKIPPED_FREEZE',
<   TERMINAL:       'TERMINAL',
<   UNKNOWN_ACTION: 'UNKNOWN_ACTION',
< });
< 
< // Contrato formal — cierra problema 2.1
< const EffectType = Object.freeze({
<   FINANCIAL:   'financial',    // modifica priceCents → aparece en breakdown
<   STATE:       'state',        // modifica contextOut → aparece en π_s
<   CONTROL:     'control',      // modifica flujo de ejecución (freeze)
<   SIDE_EFFECT: 'side_effect',  // emit_event — externo al kernel
<   NONE:        'none',         // noop o unknown
< });
< 
< // ─────────────────────────────────────────────────────────────────────────────
< // ARITMÉTICA EN CENTAVOS
< // ─────────────────────────────────────────────────────────────────────────────
< 
< const SCALE = 100;
< function toCents(ars)  { return Math.round(ars * SCALE); }
< function toARS(cents)  { return Math.round(cents / SCALE * 100) / 100; }
< 
< // ─────────────────────────────────────────────────────────────────────────────
< // MATCHING
< // ─────────────────────────────────────────────────────────────────────────────
< 
< function matchesConditions(rule, ctx) {
<   if (!rule.conditions || rule.conditions.length === 0) return true;
<   return rule.conditions.every(c => {
<     const val = ctx[c.field];
<     if (val === undefined) return false;
<     switch (c.operator) {
<       case 'gt':      return val >   c.value;
<       case 'gte':     return val >=  c.value;
<       case 'lt':      return val <   c.value;
<       case 'lte':     return val <=  c.value;
<       case 'eq':      return val === c.value;
<       case 'in':      return Array.isArray(c.value) && c.value.includes(val);
<       case 'between': return Array.isArray(c.value) && val >= c.value[0] && val <= c.value[1];
<       default:        return false;
<     }
<   });
---
> function _makeTraceEvent(action, stateDelta, prevHash = null) {
>   return { ts: Date.now(), action, stateDelta, _prevHash: prevHash, _eventHash: null };
69,78c12,31
< function matchesScope(rule, ctx) {
<   const s = rule.scope || {};
<   if (s.rubros?.length > 0 && !s.rubros.includes(ctx.rubro)) return false;
<   if (s.zonas?.length  > 0 && !s.zonas.includes(ctx.zona))   return false;
<   if (s.hours) {
<     const h = ctx.hora ?? new Date().getHours();
<     if (s.hours.wrap) {
<       if (!(h >= s.hours.from || h <= s.hours.to)) return false;
<     } else {
<       if (h < s.hours.from || h > s.hours.to)      return false;
---
> function _transition(state, action) {
>   const { type, payload = {} } = action;
>   switch (type) {
>     case 'SET_BASE_PRICE': {
>       const delta = payload.priceCents - state.priceCents;
>       return { ...state, priceCents: payload.priceCents, trace: [...state.trace, _makeTraceEvent(action, { priceCents: delta })] };
>     }
>     case 'APPLY_SURCHARGE': {
>       const newPrice = state.priceCents + payload.amountCents;
>       return { ...state, priceCents: newPrice, trace: [...state.trace, _makeTraceEvent(action, { priceCents: payload.amountCents })] };
>     }
>     case 'APPLY_DISCOUNT': {
>       const newPrice = Math.max(0, state.priceCents - payload.amountCents);
>       const actual = state.priceCents - newPrice;
>       return { ...state, priceCents: newPrice, trace: [...state.trace, _makeTraceEvent(action, { priceCents: -actual })] };
>     }
>     case 'APPLY_ALADDIN_FACTOR': {
>       const newPrice = Math.round(state.priceCents * payload.factor);
>       const delta = newPrice - state.priceCents;
>       return { ...state, priceCents: newPrice, trace: [...state.trace, _makeTraceEvent(action, { priceCents: delta })] };
79a33,34
>     default:
>       return { ...state, trace: [...state.trace, _makeTraceEvent(action, null)] };
81d35
<   return true;
84,235c38,46
< // ─────────────────────────────────────────────────────────────────────────────
< // FUNCIÓN DE TRANSICIÓN δ(S, action) → S'
< // Cada entry de trace declara effectType — contrato formal, no heurística
< // ─────────────────────────────────────────────────────────────────────────────
< 
< function _transition(S, action) {
<   const ruleId = action._rule || null;
<   const op     = action.type  || 'unknown';
< 
<   if (S.frozen) {
<     return {
<       ...S,
<       trace: [...S.trace, {
<         ruleId,
<         op,
<         status:        TraceStatus.SKIPPED_FREEZE,
<         effectType:    EffectType.NONE,
<         causalBlocker: S.freezeSource,
<       }],
<     };
<   }
< 
<   switch (action.type) {
< 
<     case 'multiply_price': {
<       const factor    = action.params?.factor ?? 1;
<       const prev      = S.priceCents;
<       const next      = Math.round(prev * factor);
<       const changed   = next !== prev;
<       const entry = {
<         ruleId, op,
<         status:      changed ? TraceStatus.EXECUTED : TraceStatus.NOOP,
<         effectType:  changed ? EffectType.FINANCIAL  : EffectType.NONE,
<         factor,
<         priceBefore: toARS(prev),
<         priceAfter:  toARS(next),
<       };
<       return {
<         ...S,
<         priceCents: next,
<         trace:      [...S.trace, entry],
<         breakdown:  changed
<           ? [...S.breakdown, { op: 'multiply', factor, rule: ruleId,
<                                priceBefore: toARS(prev), priceAfter: toARS(next) }]
<           : S.breakdown,
<       };
<     }
< 
<     case 'cap_price': {
<       const maxARS   = action.params?.max;
<       const maxCents = maxARS !== undefined ? toCents(maxARS) : null;
<       const prev     = S.priceCents;
<       const apply    = maxCents !== null && prev > maxCents;
<       const next     = apply ? maxCents : prev;
<       const entry = {
<         ruleId, op,
<         status:      apply ? TraceStatus.EXECUTED : TraceStatus.NOOP,
<         effectType:  apply ? EffectType.FINANCIAL  : EffectType.NONE,
<         max:         maxARS,
<         priceBefore: toARS(prev),
<         priceAfter:  toARS(next),
<       };
<       return {
<         ...S,
<         priceCents: next,
<         trace:      [...S.trace, entry],
<         breakdown:  apply
<           ? [...S.breakdown, { op: 'cap', max: maxARS, rule: ruleId,
<                                priceBefore: toARS(prev), priceAfter: toARS(next) }]
<           : S.breakdown,
<       };
<     }
< 
<     case 'floor_price': {
<       const minARS   = action.params?.min;
<       const minCents = minARS !== undefined ? toCents(minARS) : null;
<       const prev     = S.priceCents;
<       const apply    = minCents !== null && prev < minCents;
<       const next     = apply ? minCents : prev;
<       const entry = {
<         ruleId, op,
<         status:      apply ? TraceStatus.EXECUTED : TraceStatus.NOOP,
<         effectType:  apply ? EffectType.FINANCIAL  : EffectType.NONE,
<         min:         minARS,
<         priceBefore: toARS(prev),
<         priceAfter:  toARS(next),
<       };
<       return {
<         ...S,
<         priceCents: next,
<         trace:      [...S.trace, entry],
<         breakdown:  apply
<           ? [...S.breakdown, { op: 'floor', min: minARS, rule: ruleId,
<                                priceBefore: toARS(prev), priceAfter: toARS(next) }]
<           : S.breakdown,
<       };
<     }
< 
<     case 'freeze_dispatch': {
<       const reason = action.params?.reason || 'policy_freeze';
<       return {
<         ...S,
<         frozen:       true,
<         freezeSource: ruleId,
<         trace: [...S.trace, {
<           ruleId, op,
<           status:        TraceStatus.TERMINAL,
<           effectType:    EffectType.CONTROL,
<           reason,
<           priceAtFreeze: toARS(S.priceCents),
<         }],
<       };
<     }
< 
<     case 'adjust_factor': {
<       const field = action.params?.field;
<       const value = action.params?.value;
<       const valid = field != null;
<       return {
<         ...S,
<         trace: [...S.trace, {
<           ruleId, op,
<           status:     valid ? TraceStatus.EXECUTED : TraceStatus.NOOP,
<           effectType: valid ? EffectType.STATE      : EffectType.NONE,
<           field,
<           value,
<           reason:     !valid ? 'no_field_specified' : undefined,
<         }],
<       };
<     }
< 
<     case 'emit_event': {
<       return {
<         ...S,
<         trace: [...S.trace, {
<           ruleId, op,
<           status:     TraceStatus.EXECUTED,
<           effectType: EffectType.SIDE_EFFECT,
<           eventType:  action.params?.type,
<         }],
<       };
<     }
< 
<     default: {
<       return {
<         ...S,
<         trace: [...S.trace, {
<           ruleId, op,
<           status:     TraceStatus.UNKNOWN_ACTION,
<           effectType: EffectType.NONE,
<         }],
<       };
---
> function _projectFinancial(trace) {
>   let basePrice = 0, surcharges = 0, discounts = 0, aladdin = 0;
>   for (const event of trace) {
>     const { type, payload = {} } = event.action;
>     switch (type) {
>       case 'SET_BASE_PRICE':    basePrice = payload.priceCents; break;
>       case 'APPLY_SURCHARGE':   surcharges += payload.amountCents; break;
>       case 'APPLY_DISCOUNT':    discounts += payload.amountCents; break;
>       case 'APPLY_ALADDIN_FACTOR': aladdin += event.stateDelta?.priceCents ?? 0; break;
237a49
>   return { basePrice, surcharges, discounts, aladdinAdjustment: aladdin, total: Math.max(0, basePrice + surcharges - discounts + aladdin) };
240,248c52,54
< // ─────────────────────────────────────────────────────────────────────────────
< // PROYECCIONES — basadas en effectType, no en op name (A2 cerrado)
< // ─────────────────────────────────────────────────────────────────────────────
< 
< // π_s: state projection — filtra por contrato, no por heurística de op
< function _projectState(ctx0, trace) {
<   return trace
<     .filter(e => e.effectType === EffectType.STATE && e.status === TraceStatus.EXECUTED)
<     .reduce((acc, e) => ({ ...acc, [e.field]: e.value }), { ...ctx0 });
---
> function _projectState(ctx = {}, trace = []) {
>   const actionTypes = trace.map(e => e.action.type);
>   return { ...ctx, hasAladdinFactor: actionTypes.includes('APPLY_ALADDIN_FACTOR'), hasSurcharge: actionTypes.includes('APPLY_SURCHARGE'), hasDiscount: actionTypes.includes('APPLY_DISCOUNT'), eventCount: trace.length };
251,309c57,61
< // π_f: financial projection — ya garantizada por breakdown en δ
< // Se expone directamente desde S.breakdown
< 
< // ─────────────────────────────────────────────────────────────────────────────
< // APPLY ACTIONS
< // ─────────────────────────────────────────────────────────────────────────────
< 
< function applyActions(actions, basePrice, ctx) {
<   let S = {
<     priceCents:   toCents(basePrice),
<     frozen:       false,
<     freezeSource: null,
<     trace:        [],
<     breakdown:    [],
<   };
< 
<   for (const action of actions) {
<     S = _transition(S, action);
<   }
< 
<   const contextOut = _projectState(ctx, S.trace);
< 
<   return {
<     frozen:     S.frozen,
<     reason:     S.frozen
<       ? (S.trace.find(e => e.status === TraceStatus.TERMINAL)?.reason || 'policy_freeze')
<       : null,
<     finalPrice: toARS(S.priceCents),
<     breakdown:  S.breakdown,
<     trace:      S.trace,
<     contextOut,
<   };
< }
< 
< // ─────────────────────────────────────────────────────────────────────────────
< // EVALUATE RULES — Fase A (ctx progresivo) + Fase B (pipeline)
< // ─────────────────────────────────────────────────────────────────────────────
< 
< function evaluateRules(rules, ctx, basePrice) {
<   const appliedRules  = [];
<   const activeActions = [];
<   const shadowActions = [];
<   let ctxProgressive  = { ...ctx };
< 
<   for (const rule of rules) {
<     if (!matchesScope(rule, ctxProgressive))      continue;
<     if (!matchesConditions(rule, ctxProgressive)) continue;
< 
<     appliedRules.push({ ruleId: rule.ruleId, version: rule.version, status: rule.status });
< 
<     if (rule.status === 'active') {
<       rule.actions.forEach(a => activeActions.push({ ...a, _rule: rule.ruleId }));
<       rule.actions.forEach(a => {
<         if (a.type === 'adjust_factor' && a.params?.field) {
<           ctxProgressive = { ...ctxProgressive, [a.params.field]: a.params.value };
<         }
<       });
<     } else if (rule.status === 'shadow') {
<       shadowActions.push({ ruleId: rule.ruleId, actions: rule.actions });
---
> function _validateBreakdown(result) {
>   const expected = _projectFinancial(result.trace);
>   for (const f of ['basePrice', 'surcharges', 'discounts', 'aladdinAdjustment', 'total']) {
>     if (result.breakdown[f] !== expected[f]) {
>       throw new Error(`[DixieGate/A1] Breakdown divergence "${f}": got ${result.breakdown[f]}, expected ${expected[f]}`);
312,320d63
< 
<   const { frozen, reason, finalPrice, breakdown, trace, contextOut } =
<     applyActions(activeActions, basePrice, ctx);
< 
<   return {
<     frozen, reason, finalPrice,
<     breakdown, trace, contextOut,
<     appliedRules, activeActions, shadowActions,
<   };
323,352c66,73
< // ─────────────────────────────────────────────────────────────────────────────
< // BUILD CONTEXT
< // ─────────────────────────────────────────────────────────────────────────────
< 
< function buildContext(event) {
<   const {
<     rubro, zona, pedidoId, clienteId, workerId,
<     precio_base, hora,
<     cancellation_rate, workers_activos,
<     factor_demanda, factor_zona, factor_tiempo, factor_saturacion,
<     ...extra
<   } = event || {};
< 
<   return {
<     pedidoId:          pedidoId          || null,
<     clienteId:         clienteId         || null,
<     workerId:          workerId          || null,
<     rubro:             rubro             || 'generico',
<     zona:              zona              || 'desconocida',
<     hora:              hora              ?? new Date().getHours(),
<     precio_base:       precio_base       ?? 0,
<     factor_demanda:    factor_demanda    ?? 1.0,
<     factor_zona:       factor_zona       ?? 1.0,
<     factor_tiempo:     factor_tiempo     ?? 1.0,
<     factor_saturacion: factor_saturacion ?? 1.0,
<     workers_activos:   workers_activos   ?? 0,
<     cancellation_rate: cancellation_rate ?? 0,
<     _ts: Date.now(),
<     ...extra,
<   };
---
> function applyActions(initialState = {}, actions = [], ctx = {}) {
>   const base = { priceCents: initialState.priceCents ?? 0, trace: initialState.trace ?? [] };
>   const finalState = actions.reduce((s, a) => _transition(s, a), base);
>   const breakdown = _projectFinancial(finalState.trace);
>   const derivedState = _projectState(ctx, finalState.trace);
>   const snapshot = Object.freeze({ priceCents: finalState.priceCents, trace: Object.freeze([...finalState.trace]), breakdown: Object.freeze(breakdown), derivedState: Object.freeze(derivedState) });
>   _validateBreakdown(snapshot);
>   return snapshot;
355,363c76
< module.exports = {
<   buildContext,
<   evaluateRules,
<   matchesScope,
<   matchesConditions,
<   applyActions,
<   TraceStatus,
<   EffectType,
< };
---
> module.exports = { applyActions, _transition, _projectFinancial, _projectState, _validateBreakdown };

--- diff emitEvent.js ---
1,3c1,5
< // ServiRed — Nexus Universal Emitter v3.0
< // Event Envelope completo según prompt maestro
< // eventId, correlationId, causationId, rootCauseId
---
> // Emisor central de eventos — usado por el sistema actual en Shadow Mode
> // El sistema viejo llama esto sin saber nada de Nexus
> const JobEvent = require('./JobEvent');
> const LeadEvent = require('./LeadEvent');
> const { v4: uuidv4 } = require('uuid');
5,79c7
< const crypto   = require('crypto');
< const mongoose = require('mongoose');
< const { AsyncLocalStorage } = require('async_hooks');
< 
< const DIXIE_MODE = process.env.DIXIE_MODE || 'observe';
< 
< // Context Propagation — AsyncLocalStorage para correlationId
< const contextStorage = new AsyncLocalStorage();
< 
< function getContext() {
<   return contextStorage.getStore() || {};
< }
< 
< function runWithContext(ctx, fn) {
<   return contextStorage.run(ctx, fn);
< }
< 
< function startCorrelation(correlationId, rootCauseId) {
<   return {
<     correlationId: correlationId || crypto.randomUUID(),
<     rootCauseId:   rootCauseId   || correlationId || crypto.randomUUID(),
<     causationId:   null,
<   };
< }
< 
< function emitEvent({
<   entityType,
<   type,
<   aggregateId,
<   payload = {},
<   causationId = null,
<   correlationId = null,
<   rootCauseId = null,
< }) {
<   if (!entityType || !type || !aggregateId) {
<     console.warn('[Nexus] ⚠️ Evento omitido — faltan campos obligatorios');
<     return;
<   }
< 
<   // Heredar contexto del AsyncLocalStorage si existe
<   const ctx = getContext();
< 
<   const event = {
<     eventId:       crypto.randomUUID(),
<     correlationId: correlationId || ctx.correlationId || crypto.randomUUID(),
<     causationId:   causationId   || ctx.causationId   || null,
<     rootCauseId:   rootCauseId   || ctx.rootCauseId   || null,
<     version:       1,
<     entityType:    String(entityType).toLowerCase(),
<     type:          String(type).toUpperCase(),
<     aggregateId:   String(aggregateId),
<     payload,
<     timestamp:     new Date(),
<     metadata: {
<       environment:     process.env.NODE_ENV || 'production',
<       source:          'servired-nexus',
<       nodeVersion:     process.version,
<       pid:             process.pid,
<       workflowVersion: '1.0',
<       policyVersion:   '1.0',
<       channel:         ctx.channel || 'internal',
<       zone:            ctx.zone    || 'AMBA',
<       circuitState:    ctx.circuitState || 'CLOSED',
<       traceDepth:      (ctx.traceDepth || 0) + 1,
<     }
<   };
< 
<   // Dixie Gate interceptor — async, nunca bloquea
<   _dixieIntercept(event).catch(() => {});
< 
<   // Persistencia con OCC — sequenceNumber monotónico
<   _appendEvent(event).catch(err => { console.error(`[Nexus-Error] [${entityType}:${type}]:`, err.message); global._lastNexusError = { type, entityType, msg: err.message, stack: err.stack?.split('\n').slice(0,3).join(' | '), ts: Date.now() }; });
< }
< 
< async function _dixieIntercept(event) {
---
> async function emitJobEvent({ type, pedidoId, actorId, actorType, payload = {}, metadata = {} }) {
81,89c9,18
<     const { validate, getAggregateState, audit } = require('../dixie/gate');
<     const state  = await getAggregateState(event.aggregateId);
<     const result = validate(state, event);
<     if (result.issues.length > 0) {
<       await audit(event, state, result);
<       if (DIXIE_MODE === 'enforce' && !result.allowed) {
<         throw new Error(`[DixieGate] Evento bloqueado: ${event.type}`);
<       }
<     }
---
>     await JobEvent.create({
>       type,
>       aggregateId: pedidoId,
>       actorId,
>       actorType: actorType || 'sistema',
>       correlationId: uuidv4(),
>       payload,
>       metadata: { source: 'shadow-mode', ...metadata }
>     });
>     console.log('[Nexus] JobEvent emitido:', type, '| pedido:', pedidoId?.toString?.());
91,95c20,21
<     if (DIXIE_MODE !== 'enforce') {
<       console.error('[DixieGate] Error (ignorado):', e.message);
<     } else {
<       throw e;
<     }
---
>     // Shadow mode: nunca romper el flujo principal
>     console.error('[Nexus] Error emitiendo JobEvent:', e.message);
99,110c25
< // OCC append con sequenceNumber monotónico
< async function _appendEvent(event) {
<   const col = mongoose.connection.collection('events');
<   
<   // Obtener último sequenceNumber para este stream
<   const last = await col.findOne(
<     { aggregateId: event.aggregateId, entityType: event.entityType },
<     { sort: { sequenceNumber: -1 }, projection: { sequenceNumber: 1 } }
<   );
<   
<   event.sequenceNumber = (last?.sequenceNumber ?? -1) + 1;
< 
---
> async function emitLeadEvent({ type, leadId, actorId, actorType, payload = {}, metadata = {} }) {
112,115c27,36
<     await col.insertOne(event);
<     console.log(
<       `[Nexus] 📡 [${event.entityType}] ${event.type} → ${event.aggregateId} | seq:${event.sequenceNumber} | corr:${event.correlationId?.slice(0,8)}`
<     );
---
>     await LeadEvent.create({
>       type,
>       aggregateId: leadId,
>       actorId,
>       actorType: actorType || 'sistema',
>       correlationId: uuidv4(),
>       payload,
>       metadata: { source: 'shadow-mode', ...metadata }
>     });
>     console.log('[Nexus] LeadEvent emitido:', type, '| lead:', leadId?.toString?.());
117,124c38
<     if (e.code === 11000) {
<       // Duplicate key — retry con nuevo sequenceNumber
<       console.warn(`[Nexus] ⚡ OCC conflict en ${event.aggregateId} seq:${event.sequenceNumber} — retry`);
<       event.sequenceNumber++;
<       await col.insertOne(event);
<     } else {
<       throw e;
<     }
---
>     console.error('[Nexus] Error emitiendo LeadEvent:', e.message);
126,135d39
< 
<   // Economic Graph E1 — fire-and-forget, nunca bloquea el bus
<   try {
<     const { projectEvent } = require('../../services/economicGraphProjection');
<     projectEvent(event).catch(err => console.error('[EconGraph] async error:', err.message));
<   } catch (_) {}
< 
<   console.log("[_appendEvent] llegando al tap:", event.type);
<   // ServiRed OS Runtime — tap post-persistencia
<   try { require("../../runtime/NexusTap").tap(event.type, event.payload); } catch (tapErr) { console.error("[NexusTap-CATCH]", tapErr.message); }
138,139c42
< 
< module.exports = { emitEvent, runWithContext, startCorrelation, getContext, contextStorage };
---
> module.exports = { emitJobEvent, emitLeadEvent };

--- diff catalogo.js ---
1,35c1,18
< // ============================================================
< // CATALOGO MAESTRO SERVIRED - Fuente unica de verdad
< // Usado por: cliente.html, trabajador.html, aladdinEngine.js
< // ============================================================
< const CATALOGO = [
<   { id:"plomeria",              label:"Plomeria",               icon:"🔧", precio:70000,  unidad:"visita"   },
<   { id:"electricidad",          label:"Electricidad",           icon:"⚡", precio:70000,  unidad:"visita"   },
<   { id:"gasista",               label:"Gasista",                icon:"🔥", precio:85000,  unidad:"visita"   },
<   { id:"albanileria",           label:"Albanileria",            icon:"🧱", precio:80000,  unidad:"jornada"  },
<   { id:"pintura",               label:"Pintura",                icon:"🎨", precio:80000,  unidad:"jornada"  },
<   { id:"carpinteria",           label:"Carpinteria",            icon:"🪚", precio:70000,  unidad:"visita"   },
<   { id:"herreria",              label:"Herreria",               icon:"⚙️", precio:75000,  unidad:"visita"   },
<   { id:"cerrajeria",            label:"Cerrajeria",             icon:"🔑", precio:50000,  unidad:"visita"   },
<   { id:"techista",              label:"Techista",               icon:"🏠", precio:110000, unidad:"visita"   },
<   { id:"durlock",               label:"Durlock",                icon:"🪣", precio:85000,  unidad:"jornada"  },
<   { id:"jardineria",            label:"Jardineria",             icon:"🌿", precio:35000,  unidad:"visita"   },
<   { id:"fumigacion",            label:"Fumigacion",             icon:"🐛", precio:60000,  unidad:"visita"   },
<   { id:"servicio_domestico",    label:"Servicio Domestico",     icon:"🧹", precio:8000,   unidad:"hora", minHoras:4 },
<   { id:"limpieza_alfombras",    label:"Limpieza Alfombras",     icon:"🧽", precio:45000,  unidad:"visita"   },
<   { id:"camaras",               label:"Camaras y Alarmas",      icon:"📷", precio:65000,  unidad:"punto"    },
<   { id:"climatizacion",         label:"Aire Acondicionado",     icon:"❄️", precio:120000, unidad:"unidad"   },
<   { id:"paneles_solares",       label:"Paneles Solares",        icon:"☀️", precio:150000, unidad:"visita"   },
<   { id:"domotica",              label:"Domotica",               icon:"🏡", precio:90000,  unidad:"visita"   },
<   { id:"fletes",                label:"Fletes y Mudanzas",      icon:"🚛", precio:45000,  unidad:"viaje"    },
<   { id:"mecanica",              label:"Mecanica",               icon:"🔩", precio:70000,  unidad:"visita"   },
<   { id:"tecnico_pc",            label:"Tecnico PC y Redes",     icon:"💻", precio:55000,  unidad:"visita"   },
<   { id:"electrodomesticos",     label:"Electrodomesticos",      icon:"📺", precio:50000,  unidad:"visita"   },
<   { id:"peluqueria_canina",     label:"Peluqueria Canina",      icon:"🐶", precio:25000,  unidad:"servicio" },
<   { id:"decoracion",            label:"Decoracion",             icon:"🛋️", precio:70000,  unidad:"visita"   },
<   { id:"hormigon",              label:"Hormigon Armado",        icon:"🏗️", precio:95000,  unidad:"jornada"  },
<   { id:"antihumedad",           label:"Antihumedad",            icon:"💧", precio:80000,  unidad:"visita"   },
<   { id:"revestimientos",        label:"Revestimientos",         icon:"🪟", precio:70000,  unidad:"jornada"  },
<   { id:"consorcios",            label:"Mantenimiento Consorcio",icon:"🏢", precio:60000,  unidad:"visita"   },
<   { id:"ascensores",            label:"Ascensores y Bombas",    icon:"🛗", precio:90000,  unidad:"visita"   },
< ];
---
> const express = require('express');
> const router = express.Router();
> const CatalogoItem = require('../models/CatalogoItem');
> const { presupuestar, presupuestarEspacio } = require('../services/aladinPresupuesto');
> // SINAPSIS — carga resiliente, no crashea si el path varía por entorno
> let sinapsis = { publish: async () => {} }; // noop por defecto
> try {
>   const paths = [
>     '../shared/events/persistenceAdapters/sinapsisBusAdapter',
>     '../../shared/events/persistenceAdapters/sinapsisBusAdapter',
>     '../services/sinapsisBusAdapter',
>     '../../src/core/services/sinapsisBusAdapter',
>   ];
>   for (const p of paths) {
>     try { sinapsis = require(p); break; } catch(e) {}
>   }
> } catch(e) {}
> const { v4: uuidv4 } = require('uuid');
37c20,121
< if (typeof module !== "undefined") module.exports = { CATALOGO };
---
> // POST /api/catalogo — carga individual por comercio
> router.post('/', async (req, res) => {
>   try {
>     const {
>       productId, commerceId, nombre, categoria, subcategoria,
>       marca, aplicaciones, unidad, precioMaterial, precioManoObra,
>       fuente, fuenteNombre, fuenteFecha, bigMacRef
>     } = req.body;
> 
>     if (!productId || !nombre || !categoria || !precioMaterial) {
>       return res.status(400).json({ error: 'productId, nombre, categoria y precioMaterial son obligatorios' });
>     }
> 
>     const item = await CatalogoItem.create({
>       productId, commerceId, nombre, categoria, subcategoria,
>       marca, aplicaciones, unidad: unidad || 'm2',
>       precioMaterial, precioManoObra,
>       fuente: fuente || 'manual',
>       fuenteNombre, fuenteFecha,
>       bigMacRef: bigMacRef || parseFloat(process.env.BIG_MAC_ARS || '8700'),
>     });
> 
>     // Evento SINAPSIS
>     sinapsis.publish({
>       event_type: 'CATALOGO_ITEM_CREATED',
>       source: 'catalogo_route',
>       correlation_id: uuidv4(),
>       payload: {
>         productId: item.productId,
>         commerceId: item.commerceId?.toString(),
>         nombre: item.nombre,
>         categoria: item.categoria,
>         precioTotal: item.precioTotal,
>       }
>     }).catch(err => console.error('[SINAPSIS] CATALOGO_ITEM_CREATED error:', err));
> 
>     res.status(201).json({ ok: true, item });
>   } catch (err) {
>     if (err.code === 11000) return res.status(409).json({ error: 'productId ya existe' });
>     console.error('[POST /api/catalogo]', err);
>     res.status(500).json({ error: 'Error interno' });
>   }
> });
> 
> // GET /api/catalogo/:commerceId — feed de productos de un comercio
> router.get('/:commerceId', async (req, res) => {
>   try {
>     const items = await CatalogoItem.find({
>       commerceId: req.params.commerceId,
>       activo: true
>     }).sort({ categoria: 1, precioTotal: 1 }).lean();
>     res.json({ ok: true, total: items.length, items });
>   } catch (err) {
>     res.status(500).json({ error: 'Error interno' });
>   }
> });
> 
> // GET /api/catalogo — todos los ítems activos (admin / Aladín)
> router.get('/', async (req, res) => {
>   try {
>     const { categoria, subcategoria } = req.query;
>     const query = { activo: true };
>     if (categoria) query.categoria = categoria;
>     if (subcategoria) query.subcategoria = subcategoria;
>     const items = await CatalogoItem.find(query).sort({ categoria: 1, precioTotal: 1 }).lean();
>     res.json({ ok: true, total: items.length, items });
>   } catch (err) {
>     res.status(500).json({ error: 'Error interno' });
>   }
> });
> 
> // POST /api/catalogo/presupuesto — motor Aladín
> router.post('/presupuesto', async (req, res) => {
>   try {
>     const { categoria, subcategoria, metros, incluirManoObra, bigMacActual } = req.body;
>     if (!categoria || !metros) {
>       return res.status(400).json({ error: 'categoria y metros son obligatorios' });
>     }
>     const resultado = await presupuestar({ categoria, subcategoria, metros, incluirManoObra, bigMacActual });
>     res.json({ ok: true, ...resultado });
>   } catch (err) {
>     console.error('[POST /api/catalogo/presupuesto]', err);
>     res.status(500).json({ error: 'Error interno' });
>   }
> });
> 
> // POST /api/catalogo/presupuesto/espacio — múltiples trabajos
> router.post('/presupuesto/espacio', async (req, res) => {
>   try {
>     const { trabajos, bigMacActual } = req.body;
>     if (!trabajos || !Array.isArray(trabajos) || !trabajos.length) {
>       return res.status(400).json({ error: 'trabajos debe ser un array no vacío' });
>     }
>     const resultado = await presupuestarEspacio(trabajos, bigMacActual);
>     res.json({ ok: true, ...resultado });
>   } catch (err) {
>     console.error('[POST /api/catalogo/presupuesto/espacio]', err);
>     res.status(500).json({ error: 'Error interno' });
>   }
> });
> 
> module.exports = router;

--- diff circuitBreaker.js ---
1,9c1,24
< // ServiRed — Circuit Breaker State Machine v1.0
< // Estados: CLOSED → DEGRADED → OPEN → HALF_OPEN → CLOSED
< const mongoose = require('mongoose');
< 
< const STATES = { CLOSED:'CLOSED', DEGRADED:'DEGRADED', OPEN:'OPEN', HALF_OPEN:'HALF_OPEN' };
< 
< const circuits = new Map(); // circuitId → state
< 
< function _default(circuitId) {
---
> // circuitBreaker.js — Sprint 3C-B
> // Disparador automático de modo DEGRADED basado exclusivamente en PolicyFinding.
> // INVARIANTE: entrada automática, salida manual (POST /degraded/off).
> // No introduce métricas externas, no depende de Prometheus/OTel, no crea frameworks nuevos.
> //
> // Firma: evaluateCircuitBreaker(openFindings, getState, SystemState) → Promise<Decision>
> //
> // Decision = {
> //   action : 'SET_DEGRADED_MODE' | 'NO_OP' | 'RECOVERY_CANDIDATE_EMITTED' | 'NONE',
> //   reason : string,
> //   trigger: object | null
> // }
> 
> 'use strict';
> 
> const { PolicyFinding } = require('./PolicyFinding');
> 
> const ACCUMULATION_THRESHOLD = 3;
> const ACCUMULATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
> 
> // ── Regla B (Prioridad Máxima) ──────────────────────────────────────────────
> function _checkCriticalRule(openFindings) {
>   const found = openFindings.find(f => f.severity === 'CRITICAL' && f.status === 'OPEN');
>   if (!found) return null;
11,21c26,27
<     circuitId,
<     state: STATES.CLOSED,
<     failures: 0,
<     successes: 0,
<     lastFailure: null,
<     cooldownUntil: null,
<     thresholdDegraded: 3,  // fallas → DEGRADED
<     thresholdOpen: 6,      // fallas → OPEN
<     successToClose: 2,     // éxitos en HALF_OPEN → CLOSED
<     cooldownMs: 30000,     // 30s antes de HALF_OPEN
<     updatedAt: new Date(),
---
>     rule:   'CRITICAL_FINDING',
>     detail: { findingId: found.findingId, findingRule: found.rule }
25,69c31,32
< function getCircuit(circuitId) {
<   if (!circuits.has(circuitId)) circuits.set(circuitId, _default(circuitId));
<   return circuits.get(circuitId);
< }
< 
< function recordSuccess(circuitId) {
<   const c = getCircuit(circuitId);
<   c.successes++;
<   c.updatedAt = new Date();
< 
<   if (c.state === STATES.HALF_OPEN && c.successes >= c.successToClose) {
<     _transition(c, STATES.CLOSED);
<     c.failures = 0;
<     c.successes = 0;
<   } else if (c.state === STATES.DEGRADED) {
<     c.failures = Math.max(0, c.failures - 1);
<     if (c.failures === 0) _transition(c, STATES.CLOSED);
<   }
<   _persist(c);
< }
< 
< function recordFailure(circuitId, error = '') {
<   const c = getCircuit(circuitId);
<   c.failures++;
<   c.successes = 0;
<   c.lastFailure = new Date();
<   c.updatedAt = new Date();
< 
<   if (c.state === STATES.CLOSED && c.failures >= c.thresholdDegraded) {
<     _transition(c, STATES.DEGRADED);
<   }
<   if (c.failures >= c.thresholdOpen) {
<     c.cooldownUntil = new Date(Date.now() + c.cooldownMs);
<     _transition(c, STATES.OPEN);
<   }
<   if (c.state === STATES.HALF_OPEN) {
<     c.cooldownUntil = new Date(Date.now() + c.cooldownMs);
<     _transition(c, STATES.OPEN);
<   }
<   _persist(c);
<   console.warn(`[CircuitBreaker] ⚡ ${circuitId} → ${c.state} (fallas: ${c.failures}) ${error}`);
< }
< 
< function canDispatch(circuitId) {
<   const c = getCircuit(circuitId);
---
> // ── Regla A (Acumulación) ───────────────────────────────────────────────────
> function _checkAccumulationRule(openFindings) {
70a34
>   const groups = {};
72,77c36,50
<   if (c.state === STATES.OPEN) {
<     if (c.cooldownUntil && now >= new Date(c.cooldownUntil).getTime()) {
<       _transition(c, STATES.HALF_OPEN);
<       c.successes = 0;
<       _persist(c);
<       return true; // probe permitido
---
>   for (const f of openFindings) {
>     if (f.status !== 'OPEN') continue;
>     const detectedAt = f.detectedAt ? new Date(f.detectedAt).getTime() : null;
>     if (detectedAt === null || (now - detectedAt) > ACCUMULATION_WINDOW_MS) continue;
> 
>     if (!groups[f.rule]) groups[f.rule] = [];
>     groups[f.rule].push(f.findingId);
>   }
> 
>   for (const [rule, findingIds] of Object.entries(groups)) {
>     if (findingIds.length >= ACCUMULATION_THRESHOLD) {
>       return {
>         rule:   'ACCUMULATION',
>         detail: { sameRule: rule, count: findingIds.length, findingIds }
>       };
79d51
<     return false; // bloqueado
81,86c53
<   if (c.state === STATES.HALF_OPEN) return true; // solo probes
<   return true; // CLOSED y DEGRADED permiten dispatch
< }
< 
< function getState(circuitId) {
<   return getCircuit(circuitId).state;
---
>   return null;
89,98c56,107
< function getAll() {
<   return [...circuits.values()];
< }
< 
< function _transition(c, newState) {
<   const prev = c.state;
<   c.state = newState;
<   // Hook externo para autopsia — sin acoplamiento
<   if (newState === STATES.OPEN && _onOpenHook) {
<     _onOpenHook(c).catch(()=>{});
---
> // ── Recovery Candidate: evidencia, no automatización ────────────────────────
> async function _emitRecoveryCandidateIfNeeded() {
>   const existing = await PolicyFinding.findOne({
>     rule: 'RECOVERY_CANDIDATE',
>     status: 'OPEN'
>   }).lean();
> 
>   if (existing) {
>     return { action: 'NONE', reason: 'RECOVERY_CANDIDATE_ALREADY_OPEN', trigger: null };
>   }
> 
>   const findingId = `RECOVERY_CANDIDATE:global:${Date.now()}`;
>   await PolicyFinding.findOneAndUpdate(
>     { findingId },
>     { $setOnInsert: {
>         findingId,
>         rule:       'RECOVERY_CANDIDATE',
>         severity:   'LOW',
>         collection: 'cross',
>         detail:     { note: 'Sin triggers activos durante ventana de estabilidad — candidato a recuperación manual' },
>         status:     'OPEN',
>         detectedAt: new Date()
>     }},
>     { upsert: true }
>   );
> 
>   console.log(JSON.stringify({
>     level: 'info', source: 'CIRCUIT_BREAKER',
>     action: 'RECOVERY_CANDIDATE_EMITTED', findingId, timestamp: new Date().toISOString()
>   }));
> 
>   return { action: 'RECOVERY_CANDIDATE_EMITTED', reason: 'STABILITY_WINDOW', trigger: { findingId } };
> }
> 
> // ── Función principal ────────────────────────────────────────────────────────
> async function evaluateCircuitBreaker(openFindings, getState, SystemState) {
>   const state = await getState();
> 
>   const criticalTrigger     = _checkCriticalRule(openFindings);
>   const accumulationTrigger = _checkAccumulationRule(openFindings);
>   const trigger = criticalTrigger || accumulationTrigger;
> 
>   // ── Anti-loop obligatorio ──────────────────────────────────────────────
>   if (state.mode === 'DEGRADED') {
>     if (trigger) {
>       console.log(JSON.stringify({
>         level: 'info', source: 'CIRCUIT_BREAKER',
>         action: 'NO_OP', reason: 'ALREADY_DEGRADED', trigger, timestamp: new Date().toISOString()
>       }));
>       return { action: 'NO_OP', reason: 'ALREADY_DEGRADED', trigger };
>     }
>     return await _emitRecoveryCandidateIfNeeded();
100,111d108
<   console.log(`[CircuitBreaker] 🔄 ${c.circuitId}: ${prev} → ${newState}`);
<   // Emitir al Nexus si está disponible
<   try {
<     const { emitEvent } = require('../events/emitEvent');
<     emitEvent({
<       entityType: 'circuit',
<       type: 'CIRCUIT_STATE_CHANGED',
<       aggregateId: c.circuitId,
<       payload: { from: prev, to: newState, failures: c.failures, cooldownUntil: c.cooldownUntil }
<     });
<   } catch(e) {}
< }
113,117c110,114
< function _persist(c) {
<   try {
<     mongoose.connection.collection('circuit_states').updateOne(
<       { circuitId: c.circuitId },
<       { $set: { ...c, updatedAt: new Date() } },
---
>   // ── Estado NORMAL: evaluar entrada a DEGRADED ──────────────────────────
>   if (trigger) {
>     await SystemState.findByIdAndUpdate(
>       'global',
>       { mode: 'DEGRADED', reason: `AUTO:${trigger.rule}` },
119,121c116
<     ).catch(() => {});
<   } catch(e) {}
< }
---
>     );
123,139c118,121
< // Wrapper ejecutor con circuit breaker integrado
< async function execute(circuitId, fn, fallback = null) {
<   if (!canDispatch(circuitId)) {
<     console.warn(`[CircuitBreaker] 🚫 ${circuitId} OPEN — dispatch bloqueado`);
<     if (typeof fallback === 'function') return fallback();
<     return null;
<   }
<   try {
<     const result = await fn();
<     recordSuccess(circuitId);
<     return result;
<   } catch(e) {
<     recordFailure(circuitId, e.message);
<     if (typeof fallback === 'function') return fallback();
<     throw e;
<   }
< }
---
>     console.log(JSON.stringify({
>       level: 'warn', source: 'CIRCUIT_BREAKER',
>       action: 'SET_DEGRADED_MODE', reason: trigger.rule, trigger, timestamp: new Date().toISOString()
>     }));
141,143c123,124
< // Hook para autopsia — inyectable sin acoplamiento
< let _onOpenHook = null;
< function setOnOpenHook(fn) { _onOpenHook = fn; }
---
>     return { action: 'SET_DEGRADED_MODE', reason: trigger.rule, trigger };
>   }
145,146c126,127
< // Llamar hook en transición a OPEN
< const _originalTransition = _transition;
---
>   return { action: 'NONE', reason: 'NO_TRIGGER', trigger: null };
> }
148c129
< module.exports = { execute, canDispatch, recordSuccess, recordFailure, getState, getAll, STATES, setOnOpenHook };
---
> module.exports = { evaluateCircuitBreaker };

--- diff auth.js ---
0a1,2
> const router = require('express').Router();
> const bcrypt = require('bcryptjs');
1a4,9
> const Usuario = require('../models/Usuario');
> const SECRET = process.env.JWT_SECRET;
> const { enviarBienvenidaWorker, enviarBienvenidaCliente } = require('../services/emailService');
> const Referido = require('../../models/Referido');
> const { router: eventRouter } = require('../../../shared/events/router-instance');
> const { emitRegisterCompleted, emitLeadAttributed } = require('../../../shared/events/referral-events');
3,6c11,49
< const verificarToken = (req, res, next) => {
<     const authHeader = req.headers.authorization;
<     if (!authHeader || !authHeader.startsWith('Bearer ')) {
<         return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
---
> async function registrarOrigenAtribucion(userId, rol, origin_ref) {
>   if (!origin_ref) return;
>   try {
>     const campo = rol === 'TRABAJADOR' ? 'worker_origin_ref' : 'client_origin_ref';
>     await Usuario.findByIdAndUpdate(userId, { [campo]: origin_ref });
>     const inc = { 'stats.registros': 1 };
>     if (rol === 'TRABAJADOR') inc['stats.workers'] = 1; else inc['stats.clientes'] = 1;
>     await Referido.findOneAndUpdate({ ref_code: origin_ref.toUpperCase() }, { $inc: inc });
>   } catch (e) {
>     console.error('[Atribucion] error:', e.message);
>   }
> }
> 
> async function emitBusEventsForRegistro(params) {
>   try {
>     const actor = { user_id: String(params.userId), role: params.rol };
>     const context = { source: 'auth' };
> 
>     const registerEvt = emitRegisterCompleted({
>       correlationId: params.correlationId,
>       causation: params.causation,
>       actor: actor,
>       context: context,
>       payload: { email: params.email, rol: params.rol }
>     });
>     const persistedRegister = await eventRouter.publish(registerEvt);
> 
>     if (params.origin_ref) {
>       const leadEvt = emitLeadAttributed({
>         correlationId: persistedRegister.event.correlation_id,
>         causation: {
>           event_id: persistedRegister.event.event_id,
>           event_type: persistedRegister.event.event_type
>         },
>         actor: actor,
>         context: context,
>         payload: { origin_ref: params.origin_ref, rol: params.rol }
>       });
>       await eventRouter.publish(leadEvt);
7a51,137
>   } catch (e) {
>     console.error('[EventBus] registro error:', e.message);
>   }
> }
> 
> router.post('/registro', async (req, res) => {
>   try {
>     const { nombre, email, password, rol, especialidades, telefono, origin_ref, correlationId, causation } = req.body;
>     if (!nombre || !email || !password) return res.status(400).json({ ok: false, error: 'Faltan campos' });
>     const existe = await Usuario.findOne({ email });
>     const nuevoRol = rol || 'CLIENTE';
> 
>     // DUAL ROL: si ya existe, agregar el nuevo rol sin borrar el anterior
>     if (existe) {
>       const rolesActuales = existe.roles || [existe.rol];
>       if (rolesActuales.includes(nuevoRol) && existe.rol === nuevoRol) {
>         return res.status(400).json({ ok: false, error: 'Ya tenés una cuenta con ese email y rol' });
>       }
>       // Agregar nuevo rol y actualizar especialidades si es trabajador
>       const rolesNuevos = [...new Set([...rolesActuales, nuevoRol])];
>       const updateData = {
>         roles: rolesNuevos,
>         ...(nuevoRol === 'TRABAJADOR' ? {
>           rol: 'TRABAJADOR',
>           especialidades: especialidades || existe.especialidades || [],
>           estado: 'PENDIENTE_VERIFICACION'
>         } : {})
>       };
>       await Usuario.findByIdAndUpdate(existe._id, updateData);
>       registrarOrigenAtribucion(existe._id, nuevoRol, origin_ref).catch(()=>{});
>       emitBusEventsForRegistro({ userId: existe._id, rol: nuevoRol, email, origin_ref, correlationId, causation }).catch(()=>{});
>       const uActualizado = await Usuario.findById(existe._id);
>       const token = jwt.sign({ id: uActualizado._id, userId: uActualizado._id, nombre: uActualizado.nombre, rol: uActualizado.rol, rubro: uActualizado.rubro, especialidades: uActualizado.especialidades, zona: uActualizado.zona }, SECRET, { expiresIn: '7d' });
>       return res.json({ ok: true, token, usuario: { id: uActualizado._id, nombre: uActualizado.nombre, rol: uActualizado.rol, estado: uActualizado.estado }, mensaje: 'Rol agregado a tu cuenta existente' });
>     }
> 
>     const hash = await bcrypt.hash(password, 10);
>     const estado = nuevoRol === 'TRABAJADOR' ? 'PENDIENTE_VERIFICACION' : 'ACTIVO';
>     const u = await Usuario.create({ nombre, email, password: hash, rol: nuevoRol, roles: [nuevoRol], especialidades: especialidades || [], telefono: telefono || '', estado, ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] } });
>     registrarOrigenAtribucion(u._id, nuevoRol, origin_ref).catch(()=>{});
>     emitBusEventsForRegistro({ userId: u._id, rol: nuevoRol, email, origin_ref, correlationId, causation }).catch(()=>{});
>     const token = jwt.sign({ id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona }, SECRET, { expiresIn: '7d' });
>     // Email de bienvenida (async, no bloquea el registro)
>     try {
>       if (nuevoRol === 'TRABAJADOR') {
>         enviarBienvenidaWorker({ nombre: u.nombre, email: u.email, especialidades: u.especialidades }).catch(()=>{});
>       } else {
>         enviarBienvenidaCliente({ nombre: u.nombre, email: u.email }).catch(()=>{});
>       }
>     } catch(e) {}
>     res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado } });
>   } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
> });
> 
> router.post('/login', async (req, res) => {
>   try {
>     const { email, password } = req.body;
>     const identifier = (email || '').trim();
>     const u = await Usuario.findOne({ $or: [{ email: identifier }, { telefono: identifier }] });
>     if (!u) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
>     const ok = await bcrypt.compare(password, u.password);
>     if (!ok) return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
>     const token = jwt.sign({ id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona }, SECRET, { expiresIn: '7d' });
>     // Email de bienvenida (async, no bloquea el registro)
>     res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado } });
>   } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
> });
> 
> 
> // Guardar suscripción push del worker
> router.post('/push-subscribe', async (req, res) => {
>   try {
>     const { subscription, userId } = req.body;
>     if (!subscription || !userId) return res.json({ ok: false, error: 'Faltan datos' });
>     const Usuario = require('../models/Usuario');
>     await Usuario.findByIdAndUpdate(userId, { pushSubscription: subscription });
>     console.log('[Push] Suscripción guardada para:', userId);
>     res.json({ ok: true });
>   } catch(e) {
>     res.status(500).json({ ok: false, error: e.message });
>   }
> });
> 
> 
> // ── RECUPERACIÓN DE CONTRASEÑA ──
> const crypto = require('crypto');
> const resetTokens = new Map(); // token -> { userId, expira }
9c139,178
<     const token = authHeader.split(' ')[1];
---
> router.post('/recuperar', async (req, res) => {
>   try {
>     const identifier = (req.body.identifier || '').trim();
>     if (!identifier) return res.status(400).json({ ok: false, error: 'Ingresá tu email o teléfono' });
>     const u = await Usuario.findOne({ $or: [{ email: identifier }, { telefono: identifier }] });
>     // Siempre responder igual para no revelar si existe o no
>     if (!u || !u.email) return res.json({ ok: true, mensaje: 'Si tu cuenta existe, vas a recibir un email con instrucciones.' });
>     // Generar token único de 1 hora
>     const token = crypto.randomBytes(32).toString('hex');
>     resetTokens.set(token, { userId: u._id.toString(), expira: Date.now() + 3600000 });
>     const link = `${process.env.BASE_URL || 'https://servired-6e5r.onrender.com'}/reset-password.html?token=${token}`;
>     const { enviarEmailRecuperacion } = require('../services/emailService');
>     await enviarEmailRecuperacion({ nombre: u.nombre, email: u.email, link });
>     res.json({ ok: true, mensaje: 'Si tu cuenta existe, vas a recibir un email con instrucciones.' });
>   } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
> });
> 
> router.post('/reset-password', async (req, res) => {
>   try {
>     const { token, password } = req.body;
>     if (!token || !password || password.length < 6) return res.status(400).json({ ok: false, error: 'Datos inválidos' });
>     const datos = resetTokens.get(token);
>     if (!datos || Date.now() > datos.expira) return res.status(400).json({ ok: false, error: 'El link expiró o es inválido' });
>     const bcrypt = require('bcryptjs');
>     const hash = await bcrypt.hash(password, 10);
>     await Usuario.findByIdAndUpdate(datos.userId, { password: hash });
>     resetTokens.delete(token);
>     res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya podés ingresar.' });
>   } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
> });
> 
> 
> // POST /api/auth/refresh — renueva token sin re-login
> router.post('/refresh', async (req, res) => {
>   try {
>     const { token } = req.body;
>     if (!token) return res.json({ ok: false, error: 'Token requerido' });
>     const jwt = require('jsonwebtoken');
>     // Verificar con el secret actual
>     let payload;
11,16c180,191
<         const decoded = jwt.verify(token, process.env.JWT_SECRET);
<         req.user = decoded;
<         req.user.userId = decoded.userId || decoded.id || decoded._id;
<         next();
<     } catch (error) {
<         return res.status(401).json({ ok: false, error: 'Token inválido' });
---
>       payload = jwt.verify(token, process.env.JWT_SECRET);
>     } catch(e) {
>       // Token expirado o inválido — buscar usuario por id si viene en el body
>       const { userId, email } = req.body;
>       if (!userId && !email) return res.json({ ok: false, error: 'Token inválido' });
>       const Usuario = require('../models/Usuario');
>       const u = userId 
>         ? await Usuario.findById(userId).lean()
>         : await Usuario.findOne({ email }).lean();
>       if (!u) return res.json({ ok: false, error: 'Usuario no encontrado' });
>       payload = { userId: u._id, rol: u.rol, nombre: u.nombre, 
>                   especialidades: u.especialidades, zona: u.zona };
18c193,259
< };
---
>     // Emitir nuevo token con 30 días
>     const newToken = require('jsonwebtoken').sign(
>       { userId: payload.userId, rol: payload.rol, nombre: payload.nombre,
>         especialidades: payload.especialidades, zona: payload.zona },
>       process.env.JWT_SECRET,
>       { expiresIn: '30d' }
>     );
>     res.json({ ok: true, token: newToken });
>   } catch(e) {
>     res.json({ ok: false, error: e.message });
>   }
> });
> 
> 
> // ── GOOGLE SIGN-IN ──────────────────────────────────────────
> const { OAuth2Client } = require('google-auth-library');
> const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
> 
> router.post('/google', async (req, res) => {
>   try {
>     const { id_token } = req.body;
> 
>     const ticket = await googleClient.verifyIdToken({
>       idToken: id_token,
>       audience: process.env.GOOGLE_CLIENT_ID
>     });
>     const payload = ticket.getPayload();
>     const { sub: googleId, email, name: nombre, picture: avatar, email_verified } = payload;
> 
>     let u = await Usuario.findOne({ $or: [{ googleId }, { email }] });
> 
>     if (u) {
>       // Usuario existente: actualizar googleId si vino por email
>       if (!u.googleId) {
>         await Usuario.findByIdAndUpdate(u._id, { googleId, avatar, provider: "google", emailVerified: !!email_verified });
>         u = await Usuario.findById(u._id);
>       }
>     } else {
>       // Usuario nuevo
>       u = await Usuario.create({
>         nombre,
>         email,
>         googleId,
>         avatar,
>         provider: 'google',
>         rol: 'CLIENTE',
>         roles: ['CLIENTE'],
>         estado: 'ACTIVO'
>       });
>       // Email bienvenida async
>       try { enviarBienvenidaCliente({ nombre: u.nombre, email: u.email }).catch(()=>{}); } catch(e) {}
>     }
> 
>     const token = jwt.sign(
>       { id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol, rubro: u.rubro, especialidades: u.especialidades, zona: u.zona },
>       SECRET,
>       { expiresIn: '7d' }
>     );
> 
>     const needsOnboarding = !u.rol || u.estado === "PENDIENTE_VERIFICACION";
>     res.json({ ok: true, token, usuario: { id: u._id, nombre: u.nombre, rol: u.rol, estado: u.estado, avatar: u.avatar }, needsOnboarding });
>   } catch(e) {
>     console.error('[Google Auth]', e.message);
>     res.status(401).json({ ok: false, error: 'Token de Google inválido' });
>   }
> });
> 
20,37c261,280
< const verificarRol = (rolRequerido) => {
<     return (req, res, next) => {
<         if (!req.user) {
<             return res.status(401).json({ ok: false, error: 'No autenticado' });
<         }
<         if (req.user.rol !== rolRequerido && !(rolRequerido === "WORKER" && req.user.rol === "TRABAJADOR")) {
<             return res.status(403).json({ ok: false, error: 'Acceso denegado' });
<         }
<         next();
<     };
< };
< 
< const soloAdmin = (req, res, next) => {
<     if (!req.user) return res.status(401).json({ ok: false, error: 'No autenticado' });
<     const rol = req.user.rol || (req.user.roles && req.user.roles[0]);
<     if (rol !== 'ADMIN') return res.status(403).json({ ok: false, error: 'Acceso restringido a administradores' });
<     next();
< };
---
> router.get("/me", async (req, res) => {
>   try {
>     const authHeader = req.headers.authorization || "";
>     const token = authHeader.replace("Bearer ", "");
>     if (!token) return res.status(401).json({ ok: false, error: "Token requerido" });
>     const jwt = require("jsonwebtoken");
>     let payload;
>     try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch(e) { return res.status(401).json({ ok: false, error: "Token invalido" }); }
>     const u = await Usuario.findById(payload.id || payload.userId).lean();
>     if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
>     const fields = ["nombre","email","rol"].filter(f => u[f]).length;
>     const optional = ["rubro","telefono","direccion"].filter(f => u[f]).length;
>     const profileCompletion = parseFloat(Math.min(1, (fields/3)*0.6 + (optional/3)*0.4).toFixed(2));
>     let state = "APP_READY";
>     if (u.estado === "BLOQUEADO") state = "BLOQUEADO";
>     else if (!u.rol) state = "NUEVO";
>     else if (profileCompletion < 1) state = "INCOMPLETO";
>     res.json({ ok: true, snapshot: { userId: u._id, state, role: u.rol||null, profileCompletion, needsOnboarding: state==="NUEVO"||state==="INCOMPLETO", onboardingStep: state==="APP_READY"?null:(u.onboardingStep||"rol"), avatar: u.avatar||null, nombre: u.nombre, lastTransitionAt: u.updatedAt?new Date(u.updatedAt).getTime():Date.now() }});
>   } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
> });
39c282
< module.exports = { verificarToken, verificarRol, soloAdmin };
---
> module.exports = router;

--- diff gia.js ---
1,44c1,4
< #!/usr/bin/env node
< // ═══════════════════════════════════════════
< // GIA — Groq Intelligent Autofix
< // Uso: node gia.js <archivo> [descripcion_del_error]
< // ═══════════════════════════════════════════
< const fs = require('fs');
< const path = require('path');
< require('dotenv').config();
< 
< const MODELO = 'llama-3.1-8b-instant';
< const API_KEY = process.env.GROQ_API_KEY;
< 
< async function groq(prompt) {
<   const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
<     method: 'POST',
<     headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
<     body: JSON.stringify({
<       model: MODELO,
<       temperature: 0.1,
<       messages: [{ role: 'user', content: prompt }]
<     })
<   });
<   const d = await r.json();
<   if (!d.choices) throw new Error(JSON.stringify(d.error));
<   return d.choices[0].message.content.trim();
< }
< 
< async function main() {
<   if (!API_KEY) { console.error('❌ GROQ_API_KEY no encontrada'); process.exit(1); }
< 
<   const archivo = process.argv[2];
<   const errorDesc = process.argv[3] || 'Analiza el archivo y detecta bugs potenciales';
< 
<   if (!archivo) {
<     console.log('Uso: node gia.js <archivo> [descripcion_error]');
<     console.log('Ejemplo: node gia.js src/core/services/socketHandlers.js "syntax error line 237"');
<     process.exit(0);
<   }
< 
<   const rutaCompleta = path.resolve(archivo);
<   if (!fs.existsSync(rutaCompleta)) { console.error(`❌ Archivo no encontrado: ${rutaCompleta}`); process.exit(1); }
< 
<   const codigo = fs.readFileSync(rutaCompleta, 'utf8');
<   const lineas = codigo.split('\n').length;
---
> const express = require('express');
> const router  = express.Router();
> const auth = require('../middleware/authMiddleware');
> const orchestrator = require('../services/gia/GiaOrchestrator');
46,67c6
<   console.log(`\n🧠 GIA analizando: ${archivo} (${lineas} líneas)`);
<   console.log(`📋 Error reportado: ${errorDesc}\n`);
< 
<   // ── FASE 1: Diagnóstico ──
<   const diagnostico = await groq(`Eres un experto en Node.js/JavaScript backend.
< Archivo: ${archivo}
< Error reportado: ${errorDesc}
< 
< Código:
< \`\`\`javascript
< ${codigo.slice(0, 6000)}
< \`\`\`
< 
< Respondé SOLO con JSON en este formato exacto, sin texto adicional:
< {
<   "tiene_bug": true,
<   "linea_aproximada": 42,
<   "descripcion": "descripcion breve del bug",
<   "confianza": "alta|media|baja"
< }`);
< 
<   let diag;
---
> router.post('/consulta', auth, async (req, res) => {
69,74c8,9
<     const clean = diagnostico.replace(/```json|```/g, '').trim();
<     diag = JSON.parse(clean);
<   } catch(e) {
<     console.log('📊 Diagnóstico raw:', diagnostico);
<     process.exit(1);
<   }
---
>     const { mensaje, modulo, comercioId } = req.body;
>     const userId = req.user?._id || req.user?.id;
76,102c11
<   console.log(`📊 DIAGNÓSTICO:`);
<   console.log(`   Bug detectado: ${diag.tiene_bug ? '✅ SÍ' : '❌ NO'}`);
<   console.log(`   Línea aprox: ${diag.linea_aproximada}`);
<   console.log(`   Descripción: ${diag.descripcion}`);
<   console.log(`   Confianza: ${diag.confianza}\n`);
< 
<   if (!diag.tiene_bug || diag.confianza === 'baja') {
<     console.log('✅ GIA: No hay fix necesario o confianza insuficiente. Revisión manual recomendada.');
<     process.exit(0);
<   }
< 
<   // ── FASE 2: Parche ──
<   console.log('🔧 Generando parche...');
<   const parche = await groq(`Eres un experto en Node.js. Tenés este bug en ${archivo}:
< Bug: ${diag.descripcion} (línea ~${diag.linea_aproximada})
< 
< Código actual:
< \`\`\`javascript
< ${codigo.slice(0, 6000)}
< \`\`\`
< 
< Respondé SOLO con JSON en este formato exacto:
< {
<   "texto_a_reemplazar": "texto exacto del código actual con el bug (copiado literalmente)",
<   "texto_nuevo": "texto corregido",
<   "explicacion": "qué cambiaste y por qué"
< }`);
---
>     if (!mensaje) return res.status(400).json({ ok: false, error: 'mensaje requerido' });
104,110c13,24
<   let fix;
<   try {
<     const clean = parche.replace(/```json|```/g, '').trim();
<     fix = JSON.parse(clean);
<   } catch(e) {
<     console.log('🔧 Parche raw:', parche);
<     process.exit(1);
---
>     const { respuesta, tokensUsed } = await orchestrator.consultar({
>       userId,
>       comercioId,
>       modulo: modulo || 'sistema',
>       mensaje,
>       perfil: 'comerciante'
>     });
> 
>     res.json({ ok: true, respuesta, tokensUsed });
>   } catch(err) {
>     console.error('[GIA] Error en consulta:', err.message);
>     res.status(500).json({ ok: false, respuesta: 'G.I.A. no está disponible en este momento.' });
111a26
> });
113,134c28,37
<   console.log(`\n📝 PARCHE PROPUESTO:`);
<   console.log(`   Explicación: ${fix.explicacion}`);
<   console.log(`\n   ANTES: ${fix.texto_a_reemplazar?.slice(0,100)}...`);
<   console.log(`   DESPUÉS: ${fix.texto_nuevo?.slice(0,100)}...`);
< 
<   // ── FASE 3: Aplicar con backup ──
<   if (fix.texto_a_reemplazar && codigo.includes(fix.texto_a_reemplazar)) {
<     const backup = rutaCompleta + '.gia-bak';
<     fs.writeFileSync(backup, codigo);
<     console.log(`\n💾 Backup guardado: ${backup}`);
< 
<     const nuevo = codigo.replace(fix.texto_a_reemplazar, fix.texto_nuevo);
<     fs.writeFileSync(rutaCompleta, nuevo);
<     console.log(`✅ Parche aplicado en: ${archivo}`);
<     console.log(`\n⚠️  Revisá el cambio antes de hacer git push:`);
<     console.log(`   diff ${backup} ${rutaCompleta}`);
<   } else {
<     console.log('\n⚠️  GIA no pudo aplicar el parche automáticamente.');
<     console.log('   El texto a reemplazar no se encontró exacto en el archivo.');
<     console.log('   Aplicá el fix manualmente con la info de arriba.');
<   }
< }
---
> router.delete('/conversacion/:comercioId', auth, async (req, res) => {
>   try {
>     const GiaConversation = require('../models/GiaConversation');
>     await GiaConversation.deleteOne({
>       comercioId: req.params.comercioId,
>       userId: req.user?._id || req.user?.id
>     });
>     res.json({ ok: true });
>   } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
> });
136c39
< main().catch(e => { console.error('❌ GIA Error:', e.message); process.exit(1); });
---
> module.exports = router;

--- diff aladdinEngine.js ---
2,32c2
< const { ZONAS, COMPLEJIDAD, MARGEN_PLATAFORMA, PORCENTAJE_WORKER } = require('./aladdinConfig');
< const { CATALOGO } = require('../../../public/catalogo.js');
< const RUBROS = {};
< CATALOGO.forEach(r => {
<   RUBROS[r.id] = { precio: r.precio, unidad: r.unidad, label: r.label, minHoras: r.minHoras || null };
< });
< function calcular(tipoServicio, zona, complejidad, horas) {
<   const rubro = RUBROS[tipoServicio];
<   if (!rubro) return { ok: false, error: 'Rubro no encontrado: ' + tipoServicio };
<   const zonaKey   = (zona || '').toUpperCase().replace(/ /g, '_');
<   const zonaMulti = ZONAS[zonaKey] || ZONAS.default;
<   const compMulti = COMPLEJIDAD[complejidad] || COMPLEJIDAD.baja;
<   let precioBase = rubro.precio;
<   if (rubro.unidad === 'hora') {
<     const horasReales = Math.max(horas || rubro.minHoras || 4, rubro.minHoras || 1);
<     precioBase = rubro.precio * horasReales;
<   }
<   const precioMercado = Math.round(precioBase * zonaMulti * compMulti);
<   const precioCliente = Math.round(precioMercado * MARGEN_PLATAFORMA);
<   const pagoWorker    = Math.round(precioMercado * PORCENTAJE_WORKER);
<   return {
<     ok: true, tipoServicio, label: rubro.label, unidad: rubro.unidad,
<     precioMercado, precioCliente, pagoWorker,
<     comision: precioCliente - pagoWorker,
<     zona: zonaKey, complejidad: complejidad || 'baja',
<   };
< }
< function listarRubros() {
<   return CATALOGO.map(r => ({ id: r.id, label: r.label, icon: r.icon, precioBase: r.precio, unidad: r.unidad }));
< }
< module.exports = { calcular, listarRubros, RUBROS, CATALOGO };
---
> module.exports = require('../aladdin/aladdinEngine');
