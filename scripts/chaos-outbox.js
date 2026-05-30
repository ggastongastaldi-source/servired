#!/usr/bin/env node
/**
 * SINAPSIS Chaos Suite — Outbox Failure Tests
 * Blocker 1 FIX:
 *   - Test A: crash mid-flush (proceso muere en DISPATCHING)
 *   - Test B: worker death before ACK (handler explota)
 */

const mongoose = require('mongoose');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');

const HISTORY_FILE    = path.join(__dirname, '..', '.chaos_history.jsonl');
const MONGO_URI       = process.env.MONGODB_URI || process.env.MONGO_URI;
const SLA_HARD_CAP_MS = 4500;

function log(obj) {
  fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: Date.now(), env: 'outbox', ...obj }) + '\n');
}

function makeId() {
  return crypto.randomBytes(8).toString('hex');
}

// ── Test A: crash mid-flush ──────────────────────────────────────────────────
// Escenario: outbox.dispatch() empieza → proceso "muere" → entrada queda DISPATCHING
// Recovery: recover() debe moverla a FAILED dentro del SLA
async function testCrashMidFlush() {
  const start = Date.now();
  const col   = mongoose.connection.collection('outbox');
  const dispatchId = 'chaos_crash_' + makeId();

  // 1) Insertar entrada simulando que quedó atascada en DISPATCHING hace 6 min
  await col.insertOne({
    dispatchId,
    workflowId:    'chaos_test',
    logicalStep:   'mid_flush',
    channel:       'chaos',
    template:      'crash_test',
    payload:       {},
    correlationId: crypto.randomUUID(),
    status:        'DISPATCHING',
    retries:       0,
    createdAt:     new Date(),
    scheduledAt:   new Date(),
    dispatchingAt: new Date(Date.now() - 6 * 60 * 1000), // 6 min atrás → stale
    sentAt:        null,
    error:         null,
  });

  // 2) Ejecutar recover()
  const { recover } = require('../nexus/infrastructure/outbox');
  await recover();

  // 3) Verificar que fue rescatada (FAILED con error 'recovered_from_crash')
  const rescued = await col.findOne({ dispatchId });
  const ok = rescued?.status === 'FAILED' && rescued?.error === 'recovered_from_crash';

  // 4) Limpiar
  await col.deleteOne({ dispatchId });

  const sla_ms = Date.now() - start;
  return {
    test: 'crash_mid_flush',
    functional_pass: ok,
    sla_ms,
    detail: ok ? 'huérfano rescatado correctamente' : `status=${rescued?.status} error=${rescued?.error}`,
  };
}

// ── Test B: worker death before ACK ─────────────────────────────────────────
// Escenario: dispatch() toma el job → handler explota → debe quedar FAILED, nunca DISPATCHING
async function testWorkerDeathBeforeACK() {
  const start      = Date.now();
  const col        = mongoose.connection.collection('outbox');
  const dispatchId = 'chaos_worker_' + makeId();

  // 1) Insertar entrada PENDING
  await col.insertOne({
    dispatchId,
    workflowId:    'chaos_test',
    logicalStep:   'worker_death',
    channel:       'chaos_channel',
    template:      'death_test',
    payload:       { test: true },
    correlationId: crypto.randomUUID(),
    status:        'PENDING',
    retries:       0,
    createdAt:     new Date(),
    scheduledAt:   new Date(Date.now() - 1000), // scheduledAt en el pasado → elegible
    sentAt:        null,
    error:         null,
  });

  // 2) dispatch() con handler que explota (simula worker muerte)
  const { dispatch } = require('../nexus/infrastructure/outbox');
  await dispatch({
    chaos_channel: async () => {
      throw new Error('worker_killed_by_chaos');
    }
  });

  // 3) Verificar: debe ser FAILED, nunca DISPATCHING
  const after = await col.findOne({ dispatchId });
  const notStuck  = after?.status !== 'DISPATCHING';
  const isFailed  = after?.status === 'FAILED';
  const errorSaved = after?.error === 'worker_killed_by_chaos';
  const ok = notStuck && isFailed && errorSaved;

  // 4) Limpiar
  await col.deleteOne({ dispatchId });

  const sla_ms = Date.now() - start;
  return {
    test: 'worker_death_before_ack',
    functional_pass: ok,
    sla_ms,
    detail: ok
      ? 'FAILED correctamente, sin huérfano DISPATCHING'
      : `status=${after?.status} error=${after?.error}`,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI no definida');
    process.exit(1);
  }

  console.log('🧠 SINAPSIS Chaos Suite — OUTBOX FAILURE TESTS\n');
  await mongoose.connect(MONGO_URI);
  console.log('   ✅ MongoDB conectado\n');

  const results = [];
  for (const fn of [testCrashMidFlush, testWorkerDeathBeforeACK]) {
    try {
      const r = await fn();
      results.push(r);
      const icon = r.functional_pass ? '✅' : '❌';
      console.log(`  ${icon} [${r.test}] sla=${r.sla_ms}ms — ${r.detail}`);
    } catch (e) {
      const r = { test: fn.name, functional_pass: false, sla_ms: 0, detail: e.message };
      results.push(r);
      console.log(`  ❌ [${fn.name}] ERROR: ${e.message}`);
    }
  }

  await mongoose.disconnect();

  const failures = results.filter(r => !r.functional_pass || r.sla_ms > SLA_HARD_CAP_MS);
  failures.forEach(r => log({ ...r, reason: !r.functional_pass ? 'functional_fail' : 'hard_cap_exceeded' }));
  results.filter(r => r.functional_pass && r.sla_ms <= SLA_HARD_CAP_MS)
         .forEach(r => log({ ...r, reason: 'ok' }));

  const allGood = failures.length === 0;
  console.log(`\n${allGood ? '✅ PASS — Blocker 1 cerrado' : '🚫 FAIL — revisar outbox'}`);
  if (failures.length) {
    console.log('\n❌ BLOCKERS:');
    failures.forEach(f => console.log(`   • ${f.test}: ${f.detail}`));
  }

  process.exit(allGood ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
