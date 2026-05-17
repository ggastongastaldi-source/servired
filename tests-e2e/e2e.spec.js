// ServiRed E2E — Tests para Termux (sin browser)
const http = require('http');
const https = require('https');

const BASE_URL = process.env.SERVIRED_URL || 'http://localhost:3000';
const isHttps = BASE_URL.startsWith('https');

const CLIENTE = { email: 'test@servired.com', password: 'test1234' };
const WORKER  = { email: 'debora.rouiller.1@gmail.com',       password: 'test1234' };

let passed = 0, failed = 0, clienteToken = '', workerToken = '';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      rejectUnauthorized: false,
    };
    const mod = isHttps ? https : http;
    const r = mod.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.status || res.statusCode, body: raw, json, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ok(name, pass, detail='') {
  if (pass) { passed++; console.log(`  ✅ ${name}${detail ? ' — '+detail : ''}`); }
  else       { failed++; console.log(`  ❌ ${name}${detail ? ' — '+detail : ''}`); }
}

async function run() {
  console.log(`\n🧪 ServiRed E2E\n📡 ${BASE_URL}\n${'─'.repeat(50)}`);

  // ── 1. SALUD ──────────────────────────────────────────────
  console.log('\n🟢 1. Salud del servidor');
  try {
    const r = await req('GET', '/');
    ok('GET / → 200', r.status === 200, `status ${r.status}`);
    ok('index.html tiene contenido', r.body.length > 500);
    ok('Contiene ServiRed o html', r.body.toLowerCase().includes('servired') || r.body.includes('<html'));
  } catch(e) { ok('GET /', false, e.message); }

  try {
    const r = await req('GET', '/manifest.json');
    ok('manifest.json → 200', r.status === 200);
    ok('manifest tiene name', r.json?.name?.length > 0, r.json?.name);
    ok('manifest tiene icons', Array.isArray(r.json?.icons) && r.json.icons.length > 0);
  } catch(e) { ok('manifest.json', false, e.message); }

  try {
    const r = await req('GET', '/sw.js');
    ok('sw.js → 200', r.status === 200);
    ok('sw.js tiene push handler', r.body.includes('push'));
    ok('sw.js tiene notificationclick', r.body.includes('notificationclick'));
  } catch(e) { ok('sw.js', false, e.message); }

  try {
    const r = await req('GET', '/js/rubros.js');
    ok('rubros.js → 200', r.status === 200);
  } catch(e) { ok('rubros.js', false, e.message); }

  // ── 2. AUTH ───────────────────────────────────────────────
  console.log('\n🔐 2. Autenticación');
  try {
    const r = await req('POST', '/api/auth/login', CLIENTE);
    ok('Login cliente → 200', r.status === 200, `status ${r.status}`);
    clienteToken = r.json?.token || '';
    ok('Recibe token JWT', clienteToken.length > 10, clienteToken.slice(0,20)+'...');
  } catch(e) { ok('Login cliente', false, e.message); }

  try {
    const r = await req('POST', '/api/auth/login', WORKER);
    ok('Login Débora (worker) → 200', r.status === 200, `status ${r.status}`);
    workerToken = r.json?.token || '';
    ok('Débora recibe token', workerToken.length > 10);
  } catch(e) { ok('Login Débora', false, e.message); }

  try {
    const r = await req('POST', '/api/auth/login', { email: 'no@existe.com', password: 'mal' });
    ok('Login inválido → 401/400', [400, 401, 403].includes(r.status), `status ${r.status}`);
  } catch(e) { ok('Login inválido', false, e.message); }

  // ── 3. API REST ───────────────────────────────────────────
  console.log('\n🔌 3. API REST');
  try {
    const r = await req('GET', '/api/rubros', null, clienteToken);
    ok('GET /api/rubros → no 500', r.status !== 500, `status ${r.status}`);
  } catch(e) { ok('GET /api/rubros', false, e.message); }

  try {
    const r = await req('GET', '/api/workers/disponibles', null, clienteToken);
    ok('GET /api/workers/disponibles con token', r.status !== 500, `status ${r.status}`);
  } catch(e) { ok('GET /api/workers/disponibles', false, e.message); }

  try {
    const r = await req('GET', '/api/workers/disponibles');
    ok('Sin token → 401/403', [401, 403].includes(r.status), `status ${r.status}`);
  } catch(e) { ok('Auth requerida en workers', false, e.message); }

  try {
    const r = await req('POST', '/api/smart-quote',
      { rubro: 'plomeria', horas: 2, zona: 'AMBA' }, clienteToken);
    ok('POST /api/smart-quote → no 500', r.status !== 500, `status ${r.status}`);
    if (r.json?.precioCliente) ok('smart-quote retorna precioCliente', true, `$${r.json.precioCliente}`);
    if (r.json?.pagoWorker)    ok('smart-quote retorna pagoWorker',    true, `$${r.json.pagoWorker}`);
  } catch(e) { ok('POST /api/smart-quote', false, e.message); }

  // ── 4. PANELES HTML ───────────────────────────────────────
  console.log('\n📄 4. Paneles HTML');
  for (const [nombre, path, token] of [
    ['cliente.html',   '/cliente.html',   clienteToken],
    ['trabajador.html','/trabajador.html', workerToken],
    ['admin.html',     '/admin.html',      clienteToken],
  ]) {
    try {
      const r = await req('GET', `${path}?t=${token}`);
      ok(`${nombre} → 200`, r.status === 200, `status ${r.status}`);
      ok(`${nombre} sin SyntaxError en HTML`, !r.body.includes('SyntaxError'));
      const hasLogout = r.body.includes('logout') || r.body.includes('Logout') || r.body.includes('salir');
      ok(`${nombre} tiene función logout`, hasLogout);
    } catch(e) { ok(nombre, false, e.message); }
  }

  // ── 5. PWA ────────────────────────────────────────────────
  console.log('\n📱 5. PWA');
  try {
    const r = await req('GET', '/manifest.json');
    const m = r.json || {};
    ok('manifest.start_url definido', !!m.start_url, m.start_url);
    ok('manifest.display definido', !!m.display, m.display);
    ok('manifest.theme_color definido', !!m.theme_color, m.theme_color);
    ok('Al menos 1 ícono', (m.icons||[]).length > 0);
    ok('Tiene ícono 192x192', (m.icons||[]).some(i => i.sizes === '192x192'));
    ok('Tiene ícono 512x512', (m.icons||[]).some(i => i.sizes === '512x512'));
  } catch(e) { ok('PWA manifest', false, e.message); }

  // ── 6. ARCHIVOS ESTÁTICOS ─────────────────────────────────
  console.log('\n📦 6. Archivos estáticos');
  for (const archivo of ['/style.css', '/catalogo.js', '/js/rubros.js']) {
    try {
      const r = await req('GET', archivo);
      ok(`${archivo} → 200`, r.status === 200, `${Math.round(r.body.length/1024)}kb`);
    } catch(e) { ok(archivo, false, e.message); }
  }

  // ── RESUMEN ───────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 RESULTADO: ${passed}/${total} tests pasaron`);
  if (failed > 0) console.log(`❌ ${failed} tests fallaron`);
  else console.log('🎉 Todo OK!');
  console.log('═'.repeat(50)+'\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
