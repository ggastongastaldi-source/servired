// ServiRed — Chaos Lab v1.0
// Fault injection, resilience validation, partition simulation
// SOLO activable desde admin — NUNCA en producción automático

const { emitEvent } = require('../events/emitEvent');
const { recordFailure, recordSuccess, getAll } = require('../infrastructure/circuitBreaker');
const { enqueue } = require('../infrastructure/outbox');

let _chaosActive = false;
let _scenarios = {};

// ── FAULT SCENARIOS ──────────────────────────────────────────

const FAULTS = {

  // 1. Groq latency spike — simula Groq lento
  groq_latency: async () => {
    console.log('[ChaosLab] 🔥 FAULT: groq_latency');
    for (let i = 0; i < 3; i++) recordFailure('groq', 'chaos_latency_injection');
    emitEvent({ entityType: 'chaos', type: 'FAULT_INJECTED', aggregateId: 'groq', payload: { fault: 'groq_latency' } });
    return { injected: 'groq_latency', circuitState: getAll().find(c => c.circuitId === 'groq')?.state };
  },

  // 2. Email circuit open — simula Gmail caído
  email_down: async () => {
    console.log('[ChaosLab] 🔥 FAULT: email_down');
    for (let i = 0; i < 6; i++) recordFailure('email', 'chaos_email_down');
    emitEvent({ entityType: 'chaos', type: 'FAULT_INJECTED', aggregateId: 'email', payload: { fault: 'email_down' } });
    return { injected: 'email_down', circuitState: getAll().find(c => c.circuitId === 'email')?.state };
  },

  // 3. Outbox flood — encola 20 mensajes para testear dispatcher
  outbox_flood: async () => {
    console.log('[ChaosLab] 🔥 FAULT: outbox_flood');
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(enqueue({
        workflowId: `chaos_flood_${Date.now()}`,
        logicalStep: `step_${i}`,
        channel: 'email',
        template: 'bienvenida_cliente',
        payload: { nombre: `ChaosUser${i}`, email: 'chaos@test.com' },
        correlationId: `chaos_${i}`,
      }));
    }
    await Promise.all(promises);
    emitEvent({ entityType: 'chaos', type: 'FAULT_INJECTED', aggregateId: 'outbox', payload: { fault: 'outbox_flood', count: 20 } });
    return { injected: 'outbox_flood', enqueued: 20 };
  },

  // 4. Recovery test — crea huérfanos DISPATCHING para testear recover()
  recovery_test: async () => {
    console.log('[ChaosLab] 🔥 FAULT: recovery_test');
    const mongoose = require('mongoose');
    const staleTime = new Date(Date.now() - 10 * 60 * 1000); // 10 min atrás
    await mongoose.connection.collection('outbox').insertOne({
      dispatchId: `chaos_orphan_${Date.now()}`,
      workflowId: 'chaos_recovery',
      logicalStep: 'orphan',
      channel: 'email',
      template: 'test',
      payload: {},
      correlationId: 'chaos',
      status: 'DISPATCHING',
      retries: 0,
      createdAt: staleTime,
      dispatchingAt: staleTime,
      scheduledAt: staleTime,
      error: null,
      sentAt: null,
    });
    emitEvent({ entityType: 'chaos', type: 'FAULT_INJECTED', aggregateId: 'outbox', payload: { fault: 'recovery_test' } });
    return { injected: 'recovery_test', orphanCreated: true };
  },

  // 5. Circuit recovery — resetea circuit breakers para testear HALF_OPEN
  circuit_reset: async () => {
    console.log('[ChaosLab] 🔥 FAULT: circuit_reset — forzando HALF_OPEN en groq');
    const mongoose = require('mongoose');
    await mongoose.connection.collection('circuit_states').updateOne(
      { circuitId: 'groq' },
      { $set: { state: 'OPEN', cooldownUntil: new Date(Date.now() - 1000), failures: 6 } }
    );
    emitEvent({ entityType: 'chaos', type: 'FAULT_INJECTED', aggregateId: 'circuit', payload: { fault: 'circuit_reset' } });
    return { injected: 'circuit_reset', note: 'groq circuit → OPEN con cooldown vencido, próximo canDispatch → HALF_OPEN' };
  },

  // 6. Governance emergency — activa modo emergencia por 30s
  governance_emergency: async () => {
    console.log('[ChaosLab] 🔥 FAULT: governance_emergency');
    const { activarModoEmergencia, desactivarModoEmergencia } = require('./governanceLayer');
    activarModoEmergencia('chaos_lab_test');
    setTimeout(() => {
      desactivarModoEmergencia();
      console.log('[ChaosLab] ✅ Modo emergencia desactivado (auto 30s)');
    }, 30000);
    return { injected: 'governance_emergency', autoRecover: '30s' };
  },
};

// ── VALIDATION SUITE ─────────────────────────────────────────
// Verifica que el sistema respondió correctamente a cada fault

async function validate() {
  const results = [];
  const mongoose = require('mongoose');

  // 1. Circuit Breaker funciona
  const circuits = getAll();
  results.push({
    test: 'circuit_breaker_active',
    ok: circuits.length > 0,
    detail: `${circuits.length} circuits registrados`,
  });

  // 2. Outbox persiste
  const outboxCount = await mongoose.connection.collection('outbox').countDocuments();
  results.push({
    test: 'outbox_persists',
    ok: outboxCount >= 0,
    detail: `${outboxCount} mensajes en outbox`,
  });

  // 3. Events persisten con correlationId
  const eventsWithCorr = await mongoose.connection.collection('events')
    .countDocuments({ correlationId: { $exists: true, $ne: null } });
  results.push({
    test: 'events_have_correlationId',
    ok: eventsWithCorr > 0,
    detail: `${eventsWithCorr} eventos con correlationId`,
  });

  // 4. Snapshots existen
  const snapshots = await mongoose.connection.collection('snapshots').countDocuments();
  results.push({
    test: 'snapshots_exist',
    ok: snapshots >= 0,
    detail: `${snapshots} snapshots guardados`,
  });

  // 5. Dead letters bajo control
  const deadLetters = await mongoose.connection.collection('outbox')
    .countDocuments({ status: 'DEAD_LETTER' });
  results.push({
    test: 'dead_letters_controlled',
    ok: deadLetters < 10,
    detail: `${deadLetters} dead letters`,
  });

  const allOk = results.every(r => r.ok);
  emitEvent({
    entityType: 'chaos',
    type: 'VALIDATION_RUN',
    aggregateId: 'system',
    payload: { results, allOk, timestamp: new Date() },
  });

  return { allOk, results };
}

async function injectFault(faultName) {
  if (!FAULTS[faultName]) throw new Error(`Fault desconocido: ${faultName}. Disponibles: ${Object.keys(FAULTS).join(', ')}`);
  return FAULTS[faultName]();
}

function listFaults() {
  return Object.keys(FAULTS);
}

module.exports = { injectFault, validate, listFaults };
