// ServiRed — Test E2E completo de punta a punta
require('dotenv').config();
const BASE = process.env.BASE_URL || 'https://servired-6e5r.onrender.com';

let passed = 0;
let failed = 0;
let tokenCliente, tokenWorker, tokenAdmin, pedidoId;

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function ok(test, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ ${test}`);
    passed++;
  } else {
    console.log(`  ❌ ${test} ${detail}`);
    failed++;
  }
}

async function run() {
  console.log('\n🚀 ServiRed E2E Test — ' + BASE);
  console.log('━'.repeat(50));

  // ── 1. HEALTH CHECK ──────────────────────────────────────
  console.log('\n📡 1. Health Check');
  const h = await req('GET', '/api/health');
  ok('Server responde', h.status === 200);

  // ── 2. LOGIN ADMIN ───────────────────────────────────────
  console.log('\n🔐 2. Auth Admin');
  const la = await req('POST', '/api/auth/login', { email: 'gaston@servired.com', password: 'admin123' });
  ok('Login admin', la.data.ok && la.data.token, JSON.stringify(la.data));
  tokenAdmin = la.data.token;

  // ── 3. LOGIN CLIENTE ─────────────────────────────────────
  console.log('\n👤 3. Auth Cliente');
  const lc = await req('POST', '/api/auth/login', { email: 'cliente@servired.com', password: 'Test2026ok' });
  ok('Login cliente', lc.data.ok && lc.data.token, JSON.stringify(lc.data));
  tokenCliente = lc.data.token;

  // ── 4. LOGIN WORKER (DEBORA) ─────────────────────────────
  console.log('\n👷 4. Auth Worker');
  const lw = await req('POST', '/api/auth/login', { email: 'debora.rouiller.1@gmail.com', password: 'debora123' });
  ok('Login Débora', lw.data.ok && lw.data.token, JSON.stringify(lw.data));
  tokenWorker = lw.data.token;

  // ── 5. SMART QUOTE ───────────────────────────────────────
  console.log('\n🧠 5. Smart Quote (Aladín)');
  const sq = await req('POST', '/api/smart-quote', { rubro: 'plomeria', complejidad: 'baja', zona: 'la_matanza' });
  ok('SmartQuote responde', sq.data.ok, JSON.stringify(sq.data).slice(0,100));
  ok('SmartQuote tiene precio', sq.data.total_estimado > 0);

  // ── 6. CREAR PEDIDO ──────────────────────────────────────
  console.log('\n📋 6. Crear Pedido');
  const cp = await req('POST', '/api/pedidos', {
    tipoServicio: 'servicio_domestico',
    descripcion: 'Test E2E automatizado',
    direccion: 'Palena 107, Isidro Casanova',
    zona: 'la_matanza',
    lat: -34.685,
    lon: -58.617,
    total_estimado: 30000,
    pago_worker: 24000,
  }, tokenCliente);
  ok('Pedido creado', cp.data.ok || cp.data._id || cp.data.pedido, JSON.stringify(cp.data).slice(0,150));
  pedidoId = cp.data._id || cp.data.pedido?._id || cp.data.id;

  // ── 7. PANEL ADMIN — ver pedidos ─────────────────────────
  console.log('\n🖥️  7. Admin Panel');
  const ap = await req('GET', '/api/admin/pedidos', null, tokenAdmin);
  ok('Admin ve pedidos', ap.data.ok !== false, JSON.stringify(ap.data).slice(0,100));

  const aw = await req('GET', '/api/admin/trabajadores', null, tokenAdmin);
  ok('Admin ve workers', aw.data.ok !== false);

  // ── 8. NEXUS — circuit breaker ───────────────────────────
  console.log('\n⚡ 8. NEXUS Circuit Breaker');
  const cb = await req('GET', '/api/admin/circuit-breaker', null, tokenAdmin);
  ok('Circuit Breaker endpoint', cb.status === 200);

  // ── 9. NEXUS — outbox stats ──────────────────────────────
  console.log('\n📥 9. NEXUS Outbox');
  const ob = await req('GET', '/api/admin/outbox/stats', null, tokenAdmin);
  ok('Outbox stats endpoint', ob.status === 200);

  // ── 10. NEXUS — governance ───────────────────────────────
  console.log('\n🏛️  10. Governance');
  const gv = await req('GET', '/api/admin/governance/policies', null, tokenAdmin);
  ok('Governance policies', gv.data.ok && gv.data.policies);
  ok('Sin modo emergencia', gv.data.policies?.modoEmergencia === false);

  // ── 11. CHAOS VALIDATE ───────────────────────────────────
  console.log('\n🔥 11. Chaos Lab Validation');
  const cv = await req('GET', '/api/admin/chaos/validate', null, tokenAdmin);
  ok('Chaos validate responde', cv.status === 200);
  if (cv.data.results) {
    cv.data.results.forEach(r => ok(`  ${r.test}`, r.ok, r.detail));
  }

  // ── 12. NARRATIVE FEED ───────────────────────────────────
  console.log('\n📖 12. Narrative Observer');
  const nf = await req('GET', '/api/admin/narrative/feed', null, tokenAdmin);
  ok('Narrative feed endpoint', nf.status === 200);

  // ── 13. AUCTION — últimas subastas ───────────────────────
  console.log('\n🔨 13. Auction Engine');
  const au = await req('GET', '/api/admin/auction/last', null, tokenAdmin);
  ok('Auction endpoint', au.status === 200);

  // ── RESUMEN ──────────────────────────────────────────────
  console.log('\n' + '━'.repeat(50));
  console.log(`📊 RESULTADO: ${passed} ✅ OK | ${failed} ❌ FALLOS`);
  if (failed === 0) {
    console.log('🎉 TODOS LOS TESTS PASARON — ServiRed operacional\n');
  } else {
    console.log('⚠️  Hay fallos — revisar los ❌ arriba\n');
  }
}

run().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
