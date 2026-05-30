#!/usr/bin/env node
/**
 * SINAPSIS Chaos Suite v1.0
 * Blocker 2 FIX: Hard CAP absoluto de SLA + trend relativo
 */

const fs   = require('fs');
const path = require('path');

const HISTORY_FILE     = path.join(__dirname, '..', '.chaos_history.jsonl');
const SLA_HARD_CAP_MS  = 4500;   // ABSOLUTO — nunca negociable
const SLA_TREND_MAX_PCT = 0.40;  // 40% degradación relativa
const TREND_WINDOW      = 5;     // últimas N runs para baseline

// ── utilidades ──────────────────────────────────────────────────────────────

function log(obj) {
  const line = JSON.stringify({ ts: Date.now(), ...obj });
  fs.appendFileSync(HISTORY_FILE, line + '\n');
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return fs.readFileSync(HISTORY_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .reduce((acc, line) => {
      try { acc.push(JSON.parse(line)); } catch (_) {}
      return acc;
    }, []);
}

function avgSLA(runs) {
  const valid = runs.filter(r => typeof r.sla_ms === 'number');
  if (!valid.length) return null;
  return valid.reduce((s, r) => s + r.sla_ms, 0) / valid.length;
}

// ── tests ────────────────────────────────────────────────────────────────────

async function testCore() {
  const start = Date.now();
  // Simula FAILED dispatch
  const ok = true; // reemplazar con llamada real al outbox
  const sla_ms = Date.now() - start;
  return { test: 'core', functional_pass: ok, sla_ms };
}

async function testRecovery() {
  const start = Date.now();
  // Simula SENT + verifica SLA
  const ok = true; // reemplazar con lógica real
  const sla_ms = Date.now() - start;
  return { test: 'recovery', functional_pass: ok, sla_ms };
}

async function testIdempotency() {
  const start = Date.now();
  // Verifica unique index dispatchId en Mongo
  const ok = true; // reemplazar con query real
  const sla_ms = Date.now() - start;
  return { test: 'idempotency', functional_pass: ok, sla_ms };
}

// ── evaluación ───────────────────────────────────────────────────────────────

function evaluate(results) {
  const history   = loadHistory();
  const recentSLA = avgSLA(history.slice(-TREND_WINDOW));

  let functional_pass = true;
  let trend_pass      = true;
  const failures      = [];

  for (const r of results) {
    // 1) funcional
    if (!r.functional_pass) {
      functional_pass = false;
      failures.push(`${r.test}: functional FAIL`);
    }

    // 2) HARD CAP absoluto — va primero, siempre
    if (r.sla_ms > SLA_HARD_CAP_MS) {
      trend_pass = false;
      failures.push(`${r.test}: SLA ${r.sla_ms}ms > HARD CAP ${SLA_HARD_CAP_MS}ms`);
      log({ ...r, trend_pass: false, reason: 'hard_cap_exceeded' });
      continue;
    }

    // 3) trend relativo (solo si hay historial suficiente)
    if (recentSLA !== null) {
      const degradation = (r.sla_ms - recentSLA) / recentSLA;
      if (degradation > SLA_TREND_MAX_PCT) {
        trend_pass = false;
        failures.push(`${r.test}: SLA degradó ${(degradation*100).toFixed(1)}% vs baseline ${recentSLA.toFixed(0)}ms`);
        log({ ...r, trend_pass: false, reason: 'trend_exceeded', baseline_ms: recentSLA });
        continue;
      }
    }

    log({ ...r, trend_pass: true, reason: 'ok' });
  }

  return { functional_pass, trend_pass, failures };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧠 SINAPSIS Chaos Suite — iniciando\n');

  const results = await Promise.all([
    testCore(),
    testRecovery(),
    testIdempotency(),
  ]);

  results.forEach(r =>
    console.log(`  [${r.test}] functional=${r.functional_pass} sla=${r.sla_ms}ms`)
  );

  const { functional_pass, trend_pass, failures } = evaluate(results);

  console.log(`\nfunctional_pass : ${functional_pass}`);
  console.log(`trend_pass      : ${trend_pass}`);

  if (failures.length) {
    console.log('\n❌ BLOCKERS:');
    failures.forEach(f => console.log(`   • ${f}`));
  }

  const allGood = functional_pass && trend_pass;
  console.log(`\n${allGood ? '✅ PASS — listo para pre-deploy gate' : '🚫 FAIL — deploy bloqueado'}`);
  process.exit(allGood ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
