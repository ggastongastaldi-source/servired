# AUDITORÍA FASE IV-C — Verificación final
Generado: Wed Jul  1 06:02:26 -03 2026

## ¿policyEvaluator (Aladdín Kernel v2) referenciado dinámicamente en algún lado?

## Contenido completo de src/core/services/policyEvaluator.js (primeras 15 líneas, para confirmar identidad)
/**
 * policyEvaluator.js — Aladdín Kernel v2
 * Event Sourcing / Proyección pura
 * INVARIANTE: δ solo muta priceCents + trace. breakdown = π_f(trace)
 */
'use strict';

function _makeTraceEvent(action, stateDelta, prevHash = null) {
  return { ts: Date.now(), action, stateDelta, _prevHash: prevHash, _eventHash: null };
}

function _transition(state, action) {
  const { type, payload = {} } = action;
  switch (type) {
    case 'SET_BASE_PRICE': {

## ¿Quién usa priceCents / breakdown / applyActions estilo Aladdin Kernel v2?
./services/kernelValidator.js
./services/policyEvaluator.js
./services/policySimulationEngine.js
./src/core/services/policyEvaluator.js

## admin.js — rutas completas expuestas (candidatas a reuso SOC)
17:router.get('/pedidos', authAdmin, async (req, res) => {
26:router.get('/trabajadores', authAdmin, async (req, res) => {
35:router.post('/trabajadores/:id/verificar', authAdmin, async (req, res) => {
50:router.get('/stats', authAdmin, async (req, res) => {
69:router.delete('/trabajadores/:id', authAdmin, async (req, res) => {
80:router.post('/trabajadores/:id/desactivar', authAdmin, async (req, res) => {
91:router.post('/pedidos/:id/cancelar', authAdmin, async (req, res) => {
102:router.post('/pedidos/:id/reasignar', authAdmin, async (req, res) => {
114:router.get('/circuit-breaker', authAdmin, (req, res) => {
123:router.get('/outbox/stats', authAdmin, async (req, res) => {
132:router.get('/workflow/snapshot/:entityType/:id', authAdmin, async (req, res) => {
140:router.post('/workflow/integrity/:entityType/:id', authAdmin, async (req, res) => {
150:router.get('/governance/policies', authAdmin, (req, res) => {
157:router.post('/governance/emergencia', authAdmin, (req, res) => {
165:router.delete('/governance/emergencia', authAdmin, (req, res) => {
183:router.get('/chaos/faults', authAdmin, (req, res) => {
190:router.post('/chaos/inject/:fault', authAdmin, async (req, res) => {
198:router.get('/chaos/validate', authAdmin, async (req, res) => {
208:router.get('/narrative/feed', authAdmin, async (req, res) => {
216:router.get('/narrative/trs', authAdmin, async (req, res) => {
225:router.get('/auditor/dispatches', authAdmin, async (req, res) => {
232:router.get('/auditor/autopsies', authAdmin, async (req, res) => {
239:router.post('/auditor/autopsia/:circuitId', authAdmin, async (req, res) => {
254:router.get('/auction/last', authAdmin, async (req, res) => {
266:router.get('/shadow/report', authAdmin, (req, res) => {
277:router.get('/shadow/diag', authAdmin, (req, res) => {
292:router.post('/nexus/replay', authAdmin, async (req, res) => {
305:router.get('/nexus/projections', authAdmin, async (req, res) => {

## nexus/dixie/gate.js — primeras 30 líneas (DixieGate real)
./nexus/dixie/gate.js
// Dixie Gate v1.0 — Audit Layer
// DIXIE_MODE=observe: nunca bloquea, solo registra
const crypto   = require('crypto');
const mongoose = require('mongoose');

const DIXIE_MODE         = process.env.DIXIE_MODE || 'observe';
const DIXIE_RULE_VERSION = '1.0.0';

// FSM de transiciones válidas
const JOB_TRANSITIONS = {
  'VOID':       ['JOB_CREATED'],
  'JOB_CREATED':  ['JOB_ASSIGNED', 'JOB_CANCELED'],
  'JOB_ASSIGNED': ['JOB_STARTED',  'JOB_CANCELED'],
  'JOB_STARTED':  ['JOB_COMPLETED','JOB_CANCELED'],
  'JOB_COMPLETED':['JOB_PAID'],
  'JOB_PAID':     [],
  'JOB_CANCELED': []
};

const PAYMENT_TRANSITIONS = {
  'NONE':    ['JOB_PAID'],
  'PENDING': ['JOB_PAID'],
  'PAID':    []
};

function md5(obj) {
  return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
}

async function getAggregateState(aggregateId) {

## src/sinapsis/dixieTerminal/circuitBreaker.js — ¿quién lo llama en runtime real (fuera de tests)?
./src/sinapsis/dixieTerminal/circuitBreaker.js:6:// Firma: evaluateCircuitBreaker(openFindings, getState, SystemState) → Promise<Decision>
./src/sinapsis/dixieTerminal/circuitBreaker.js:91:async function evaluateCircuitBreaker(openFindings, getState, SystemState) {
./src/sinapsis/dixieTerminal/circuitBreaker.js:129:module.exports = { evaluateCircuitBreaker };
./src/sinapsis/dixieTerminal/dixieScanner.js:10:const { evaluateCircuitBreaker } = require('./circuitBreaker');
./src/sinapsis/dixieTerminal/dixieScanner.js:144:  const breakerDecision = await evaluateCircuitBreaker(openFindings, getState, SystemState);

## routes/gia.js — ¿está montado en server.js?

## Huérfanos confirmados: ¿algo requiere estos 3 archivos?
--- nexus/eventstore/emitEvent.js ---
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
--- nexus/shared/dixieGate.js ---
--- src/core/services/analyticsService.js ---
./src/core/routes/analytics.js:4:const svc      = require('../services/analyticsService');
--- src/sinapsis/dixieGate.js ---
