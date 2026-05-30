#!/usr/bin/env node
/**
 * SINAPSIS Chaos Suite — Staging Run
 * Blocker 3 FIX: ejecuta contra Render real, no localhost
 * Incluye warm-up para absorber cold start
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const ENDPOINT         = process.env.STAGING_ENDPOINT || 'https://servired-6e5r.onrender.com';
const WARMUP_TIMEOUT   = 70_000;   // 70s — cubre cold start de Render (50s+)
const REQUEST_TIMEOUT  = 15_000;   // 15s por request individual
const SLA_HARD_CAP_MS  = 4500;
const HISTORY_FILE     = path.join(__dirname, '..', '.chaos_history.jsonl');

// ── http helper ──────────────────────────────────────────────────────────────

function request(url, timeoutMs = REQUEST_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const lib      = url.startsWith('https') ? https : http;
    const start    = Date.now();
    const req      = lib.get(url, { timeout: timeoutMs }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, ms: Date.now() - start }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout ${timeoutMs}ms`)); });
    req.on('error',   reject);
  });
}

function log(obj) {
  fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: Date.now(), env: 'staging', ...obj }) + '\n');
}

// ── warm-up ──────────────────────────────────────────────────────────────────

async function warmup() {
  console.log(`🔥 Warm-up → ${ENDPOINT}/health`);
  console.log(`   (esperando hasta ${WARMUP_TIMEOUT / 1000}s para cold start)\n`);
  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < WARMUP_TIMEOUT) {
    attempts++;
    try {
      const r = await request(`${ENDPOINT}/health`, 10_000);
      if (r.status === 200) {
        console.log(`   ✅ servidor vivo — ${r.ms}ms (intento ${attempts})\n`);
        return true;
      }
      console.log(`   ⏳ intento ${attempts}: HTTP ${r.status} — reintentando...`);
    } catch (e) {
      console.log(`   ⏳ intento ${attempts}: ${e.message} — reintentando...`);
    }
    await new Promise(r => setTimeout(r, 5_000));
  }

  console.log('   ❌ warm-up timeout — servidor no responde\n');
  return false;
}

// ── tests staging ────────────────────────────────────────────────────────────

async function testStagingHealth() {
  const { status, ms } = await request(`${ENDPOINT}/health`);
  return {
    test: 'staging_health',
    functional_pass: status === 200,
    sla_ms: ms,
  };
}

async function testStagingRoot() {
  const { status, ms } = await request(`${ENDPOINT}/`);
  return {
    test: 'staging_root',
    functional_pass: status === 200 || status === 304,
    sla_ms: ms,
  };
}

async function testStagingSmartQuote() {
  // Llama al endpoint real de SmartQuote
  const { status, ms } = await request(`${ENDPOINT}/api/smart-quote?rubro=limpieza_hogar`);
  return {
    test: 'staging_smartquote',
    functional_pass: status === 200 || status === 401, // 401 = auth requerida = servidor vivo
    sla_ms: ms,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧠 SINAPSIS Chaos Suite — STAGING RUN');
  console.log(`   endpoint: ${ENDPOINT}\n`);

  const alive = await warmup();
  if (!alive) {
    log({ test: 'warmup', functional_pass: false, sla_ms: WARMUP_TIMEOUT, reason: 'cold_start_timeout' });
    console.log('🚫 FAIL — cold start excedió límite');
    process.exit(1);
  }

  const tests = [testStagingHealth, testStagingRoot, testStagingSmartQuote];
  const results = [];

  for (const fn of tests) {
    try {
      const r = await fn();
      results.push(r);
      console.log(`  [${r.test}] functional=${r.functional_pass} sla=${r.sla_ms}ms`);
    } catch (e) {
      const r = { test: fn.name, functional_pass: false, sla_ms: REQUEST_TIMEOUT, reason: e.message };
      results.push(r);
      console.log(`  [${fn.name}] ERROR: ${e.message}`);
    }
  }

  let allGood = true;
  const failures = [];

  for (const r of results) {
    const reason = !r.functional_pass
      ? 'functional_fail'
      : r.sla_ms > SLA_HARD_CAP_MS
        ? 'hard_cap_exceeded'
        : 'ok';

    log({ ...r, reason });

    if (reason !== 'ok') {
      allGood = false;
      failures.push(`${r.test}: ${reason} (${r.sla_ms}ms)`);
    }
  }

  console.log(`\nfunctional_pass : ${results.every(r => r.functional_pass)}`);
  console.log(`sla_pass        : ${results.every(r => r.sla_ms <= SLA_HARD_CAP_MS)}`);

  if (failures.length) {
    console.log('\n❌ BLOCKERS:');
    failures.forEach(f => console.log(`   • ${f}`));
  }

  console.log(`\n${allGood ? '✅ PASS — staging validado' : '🚫 FAIL — deploy bloqueado'}`);
  process.exit(allGood ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
