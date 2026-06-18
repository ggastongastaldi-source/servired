// circuitBreaker.harness.js — Sprint 3C-B
// Harness determinístico in-memory. Sin Jest, sin dependencias externas.
// Ejecutar: node src/sinapsis/dixieTerminal/__tests__/circuitBreaker.harness.js
//
// Mockea PolicyFinding (vía require.cache) antes de cargar circuitBreaker.js,
// para que los 4 escenarios corran sin tocar Mongo real.

'use strict';

const path = require('path');
const Module = require('module');

// ── Mock de PolicyFinding ───────────────────────────────────────────────────
// Estado in-memory simple: un array de "documentos" que simula la colección.
let mockCollection = [];

const mockPolicyFinding = {
  findOne(filter) {
    const doc = mockCollection.find(d =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    ) || null;
    return { lean: async () => doc };
  },
  async findOneAndUpdate(filter, update) {
    let doc = mockCollection.find(d =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    );
    if (!doc && update.$setOnInsert) {
      doc = { ...update.$setOnInsert };
      mockCollection.push(doc);
    }
    return doc;
  }
};

// Interceptar el require('./PolicyFinding') que hace circuitBreaker.js
const policyFindingPath = path.resolve(__dirname, '../PolicyFinding.js');
require.cache[policyFindingPath] = {
  id: policyFindingPath,
  filename: policyFindingPath,
  loaded: true,
  exports: { PolicyFinding: mockPolicyFinding }
};

const { evaluateCircuitBreaker } = require('../circuitBreaker');

// ── Helpers ──────────────────────────────────────────────────────────────
function makeFinding(overrides = {}) {
  return {
    findingId:  overrides.findingId  || `FIND:${Math.random().toString(36).slice(2)}`,
    rule:       overrides.rule       || 'TEST_RULE',
    severity:   overrides.severity   || 'LOW',
    status:     overrides.status     || 'OPEN',
    detectedAt: overrides.detectedAt || new Date(),
    ...overrides
  };
}

function makeState(overrides = {}) {
  return { mode: 'NORMAL', reason: null, ...overrides };
}

// Mocks de getState/SystemState que recibe evaluateCircuitBreaker
function makeRuntime(initialState) {
  let state = { ...initialState };
  const getState = async () => state;
  const SystemState = {
    findByIdAndUpdate: async (_id, update) => {
      state = { ...state, ...update };
      return state;
    }
  };
  return { getState, SystemState, getCurrentState: () => state };
}

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
    console.log(`     esperado: ${JSON.stringify(expected)}`);
    console.log(`     obtenido: ${JSON.stringify(actual)}`);
  }
}

async function runScenario(name, findings, state, fn) {
  mockCollection = []; // reset entre escenarios
  console.log(`\n— ${name} —`);
  const runtime = makeRuntime(state);
  const result = await evaluateCircuitBreaker(findings, runtime.getState, runtime.SystemState);
  await fn(result, runtime);
}

// ── Caso 1: CRITICAL OPEN → DEGRADED ────────────────────────────────────────
async function caso1() {
  const findings = [makeFinding({ severity: 'CRITICAL', status: 'OPEN' })];
  await runScenario('Caso 1: CRITICAL OPEN', findings, makeState({ mode: 'NORMAL' }), async (result, runtime) => {
    assertEqual(result.action, 'SET_DEGRADED_MODE', 'action === SET_DEGRADED_MODE');
    assertEqual(result.reason, 'CRITICAL_FINDING', 'reason === CRITICAL_FINDING');
    assertEqual(runtime.getCurrentState().mode, 'DEGRADED', 'SystemState.mode quedó en DEGRADED');
  });
}

// ── Caso 2: ≥3 findings misma rule en 10 min → DEGRADED ─────────────────────
async function caso2() {
  const now = Date.now();
  const findings = [
    makeFinding({ rule: 'A', status: 'OPEN', detectedAt: new Date(now - 1000) }),
    makeFinding({ rule: 'A', status: 'OPEN', detectedAt: new Date(now - 2000) }),
    makeFinding({ rule: 'A', status: 'OPEN', detectedAt: new Date(now - 3000) })
  ];
  await runScenario('Caso 2: acumulación 3x misma rule en 10min', findings, makeState({ mode: 'NORMAL' }), async (result, runtime) => {
    assertEqual(result.action, 'SET_DEGRADED_MODE', 'action === SET_DEGRADED_MODE');
    assertEqual(result.reason, 'ACCUMULATION', 'reason === ACCUMULATION');
    assertEqual(runtime.getCurrentState().mode, 'DEGRADED', 'SystemState.mode quedó en DEGRADED');
  });
}

// Caso 2b: acumulación con findings FUERA de la ventana de 10 min → no debe disparar
async function caso2b() {
  const now = Date.now();
  const findings = [
    makeFinding({ rule: 'A', status: 'OPEN', detectedAt: new Date(now - 11 * 60 * 1000) }),
    makeFinding({ rule: 'A', status: 'OPEN', detectedAt: new Date(now - 12 * 60 * 1000) }),
    makeFinding({ rule: 'A', status: 'OPEN', detectedAt: new Date(now - 13 * 60 * 1000) })
  ];
  await runScenario('Caso 2b: 3x misma rule pero FUERA de ventana 10min', findings, makeState({ mode: 'NORMAL' }), async (result) => {
    assertEqual(result.action, 'NONE', 'action === NONE (ventana expirada, no debe disparar)');
  });
}

// ── Caso 3: ya DEGRADED + trigger activo → NO_OP, sin escritura ─────────────
async function caso3() {
  const findings = [makeFinding({ severity: 'CRITICAL', status: 'OPEN' })];
  await runScenario('Caso 3: ya DEGRADED + trigger activo', findings, makeState({ mode: 'DEGRADED', reason: 'previo' }), async (result, runtime) => {
    assertEqual(result.action, 'NO_OP', 'action === NO_OP');
    assertEqual(runtime.getCurrentState().mode, 'DEGRADED', 'mode no cambió (sin escritura repetida)');
    assertEqual(runtime.getCurrentState().reason, 'previo', 'reason no fue sobreescrito (anti-loop real, no solo mismo valor)');
  });
}

// ── Caso 4: DEGRADED + sin triggers + ventana estable → RECOVERY_CANDIDATE ──
async function caso4() {
  await runScenario('Caso 4: DEGRADED sin triggers → RECOVERY_CANDIDATE', [], makeState({ mode: 'DEGRADED' }), async (result) => {
    assertEqual(result.action, 'RECOVERY_CANDIDATE_EMITTED', 'action === RECOVERY_CANDIDATE_EMITTED');
    const emitted = mockCollection.find(d => d.rule === 'RECOVERY_CANDIDATE');
    assertEqual(!!emitted, true, 'finding RECOVERY_CANDIDATE existe en colección mock');
    assertEqual(emitted.severity, 'LOW', 'severity === LOW (sin tocar enum)');
    assertEqual(emitted.status, 'OPEN', 'status === OPEN');
  });
}

// Caso 4b: idempotencia — si ya hay un RECOVERY_CANDIDATE OPEN, no debe duplicar
async function caso4b() {
  mockCollection = [{
    findingId: 'RECOVERY_CANDIDATE:global:EXISTING',
    rule: 'RECOVERY_CANDIDATE',
    severity: 'LOW',
    status: 'OPEN'
  }];
  console.log('\n— Caso 4b: RECOVERY_CANDIDATE ya existe (idempotencia) —');
  const runtime = makeRuntime(makeState({ mode: 'DEGRADED' }));
  const result = await evaluateCircuitBreaker([], runtime.getState, runtime.SystemState);
  assertEqual(result.action, 'NONE', 'action === NONE (no duplica RECOVERY_CANDIDATE)');
  assertEqual(mockCollection.length, 1, 'colección sigue con un solo finding (sin duplicado)');
}

// ── Runner ───────────────────────────────────────────────────────────────
(async () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  Circuit Breaker Harness — Sprint 3C-B');
  console.log('═══════════════════════════════════════════════');

  await caso1();
  await caso2();
  await caso2b();
  await caso3();
  await caso4();
  await caso4b();

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
})();
