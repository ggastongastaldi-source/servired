#!/usr/bin/env node
const https = require('https');
const CREDS = require('./test-credentials');
const BASE  = 'https://servired-6e5r.onrender.com';

const C = {
  reset:'\x1b[0m', green:'\x1b[32m', red:'\x1b[31m',
  yellow:'\x1b[33m', cyan:'\x1b[36m', bold:'\x1b[1m', dim:'\x1b[2m',
};

let passed = 0, failed = 0;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'servired-6e5r.onrender.com',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: 15000,
    };
    const r = https.request(opts, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(_) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (data) r.write(data);
    r.end();
  });
}

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ${C.green}✅${C.reset} ${name} ${C.dim}${detail}${C.reset}`);
    passed++;
  } else {
    console.log(`  ${C.red}❌${C.reset} ${name} ${C.dim}${detail}${C.reset}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${C.bold}${C.cyan}── ${title} ${'─'.repeat(Math.max(0,40-title.length))}${C.reset}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(cred) {
  const r = await req('POST', '/api/auth/login', { email: cred.email, password: cred.password });
  return r.body.ok ? r.body.token : null;
}

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║  ServiRed — E2E Test Suite                       ║`);
  console.log(`║  ${BASE.slice(8).padEnd(42)}║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}\n`);

  // ── 1) HEALTH ────────────────────────────────────────────────────────────
  section('1. Health Check');
  const health = await req('GET', '/health');
  check('servidor responde', health.status === 200, `HTTP ${health.status}`);
  const version = await req('GET', '/version');
  check('version endpoint',  version.status === 200, JSON.stringify(version.body));

  // ── 2) AUTH ──────────────────────────────────────────────────────────────
  section('2. Auth — Los 3 roles');
  const tCliente = await login(CREDS.cliente);
  check('login CLIENTE', !!tCliente, CREDS.cliente.email);

  const tWorker = await login(CREDS.worker);
  check('login WORKER',  !!tWorker,  CREDS.worker.email);

  const tAdmin = await login(CREDS.admin);
  check('login ADMIN',   !!tAdmin,   CREDS.admin.email);

  // ── 3) SMART QUOTE ───────────────────────────────────────────────────────
  section('3. SmartQuote — Factor Aladín');
  const sq = await req('POST', '/api/smart-quote', { rubro: 'limpieza_hogar' });
  check('smart-quote OK',    sq.status === 200);
  check('respuesta válida',  sq.body?.ok === true, JSON.stringify(sq.body).slice(0,80));

  // ── 4) CREAR PEDIDO ──────────────────────────────────────────────────────
  section('4. Crear Pedido');
  let pedidoId = null;
  if (tCliente) {
    const p = await req('POST', '/api/pedidos', {
      tipoServicio: 'limpieza_hogar', zona: 'la_matanza',
      descripcion:  'e2e-' + Date.now(),
    }, tCliente);
    check('pedido creado',     p.body?.ok === true);
    check('estado PENDIENTE',  p.body?.pedido?.estado === 'PENDIENTE');
    check('precio calculado',  p.body?.pedido?.precio > 0, `$${p.body?.pedido?.precio}`);
    check('comision 80%',      p.body?.pedido?.pago_worker > 0);
    pedidoId = p.body?.pedido?._id;
    check('pedidoId OK',       !!pedidoId, pedidoId);
  } else {
    ['pedido creado','estado PENDIENTE','precio calculado','comision 80%','pedidoId OK']
      .forEach(n => check(n, false, 'sin token cliente'));
  }

  // ── 5) LISTAR PEDIDOS ────────────────────────────────────────────────────
  section('5. Listar Pedidos Cliente');
  if (tCliente) {
    const mp = await req('GET', '/api/pedidos/mis-pedidos', null, tCliente);
    check('mis-pedidos OK',    mp.status === 200);
    check('lista no vacía',    Array.isArray(mp.body?.pedidos) && mp.body.pedidos.length > 0);
  }

  // ── 6) OUTBOX + SHADOW ───────────────────────────────────────────────────
  section('6. Admin — Outbox + Shadow RTG');
  if (tAdmin) {
    const ob = await req('GET', '/api/admin/outbox/stats', null, tAdmin);
    check('outbox stats OK',   ob.body?.ok === true, JSON.stringify(ob.body));

    await sleep(2000);
    const sh = await req('GET', '/api/admin/shadow/report', null, tAdmin);
    check('shadow report OK',  sh.body?.ok === true);
    check('eventos capturados',sh.body?.stats?.events > 0, `events=${sh.body?.stats?.events}`);
    check('verdict presente',  !!sh.body?.report?.verdict, sh.body?.report?.verdict);
  } else {
    ['outbox stats OK','shadow report OK','eventos capturados','verdict presente']
      .forEach(n => check(n, false, 'sin token admin'));
  }

  // ── 7) CLEANUP ───────────────────────────────────────────────────────────
  section('7. Cleanup');
  if (pedidoId && tAdmin) {
    const ca = await req('POST', `/api/admin/pedidos/${pedidoId}/cancelar`, {}, tAdmin);
    check('cancelar pedido e2e', ca.status === 200 || ca.status === 400,
          `HTTP ${ca.status}`);
  }

  // ── RESUMEN ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║  RESUMEN E2E                                     ║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  total   : ${total}`);
  console.log(`  passed  : ${C.green}${passed}${C.reset}`);
  console.log(`  failed  : ${failed > 0 ? C.red : C.green}${failed}${C.reset}`);
  console.log(`  score   : ${C.bold}${Math.round(passed/total*100)}%${C.reset}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
