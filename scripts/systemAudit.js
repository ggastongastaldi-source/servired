'use strict';
/**
 * ServiRed — System Audit Run
 * Ejecutar: node scripts/systemAudit.js
 * Verifica integridad de eventos, invariantes de métricas y consistencia de datos.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌ MONGODB_URI no definida'); process.exit(1); }

// ── Colores ──────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;

let passed = 0, warned = 0, failed = 0;
function ok(msg)   { console.log(G('  ✅ PASS') + ' ' + msg); passed++; }
function warn(msg) { console.log(Y('  ⚠️  WARN') + ' ' + msg); warned++; }
function fail(msg) { console.log(R('  ❌ FAIL') + ' ' + msg); failed++; }
function section(title) { console.log('\n' + B('─── ' + title + ' ───')); }

async function run() {
  console.log(B('\n╔══════════════════════════════════════╗'));
  console.log(B('║   ServiRed — System Audit Run        ║'));
  console.log(B('╚══════════════════════════════════════╝'));
  console.log('  ' + new Date().toISOString() + '\n');

  await mongoose.connect(MONGO_URI);
  console.log(G('  ✅ MongoDB conectado'));

  const db = mongoose.connection.db;

  // ── A) Colecciones existentes ────────────────────────
  section('A) Colecciones');
  const cols = (await db.listCollections().toArray()).map(c => c.name);
  const required = ['commerces', 'payments', 'usuarios'];
  for (const c of required) {
    if (cols.includes(c)) ok(`Colección '${c}' existe`);
    else warn(`Colección '${c}' no encontrada (puede ser nombre diferente)`);
  }

  // ── B) Integridad de marketing_events ────────────────
  // ── SINAPSIS event bus (sistema) ────────────────────
  section('B) SINAPSIS event bus');
  const sinapsisCol = db.collection('events');
  const sinapsisTotal = await sinapsisCol.countDocuments();
  console.log(`  Total eventos SINAPSIS: ${sinapsisTotal}`);
  if (sinapsisTotal > 0) {
    const sample = await sinapsisCol.findOne();
    const hasTimestamp = sample && sample.timestamp;
    hasTimestamp ? ok('Campo timestamp presente en eventos SINAPSIS') : warn('Sin timestamp en eventos SINAPSIS');
    const dist = await sinapsisCol.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 }
    ]).toArray();
    console.log('  Top tipos SINAPSIS:', dist.map(d => `${d._id}:${d.count}`).join(', '));
    ok(`SINAPSIS bus activo — ${sinapsisTotal} eventos`);
  } else {
    warn('SINAPSIS bus vacío');
  }

  // ── MarketingEvent (analytics) ───────────────────────
  section('B2) Marketing events (analytics)');
  const evColl = db.collection('marketing_events');
  if (total > 0) {
    // Sin type
    const noType = await evColl.countDocuments({ type: { $exists: false } });
    noType === 0 ? ok('Todos los eventos tienen type') : fail(`${noType} eventos sin type`);

    // Sin timestamp
    const noTs = await evColl.countDocuments({ createdAt: { $exists: false } });
    noTs === 0 ? ok('Todos los eventos tienen createdAt') : fail(`${noTs} eventos sin createdAt`);

    // Distribución por tipo
    const dist = await evColl.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('  Distribución de eventos:');
    for (const d of dist) console.log(`    ${d._id}: ${d.count}`);

    // Eventos de las últimas 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await evColl.countDocuments({ createdAt: { $gte: since24h } });
    recent > 0 ? ok(`${recent} eventos en últimas 24h`) : warn('Sin eventos en últimas 24h');
  }

  // ── C) Invariantes de métricas (si hay datos) ────────
  section('C) Invariantes de métricas');
  const total = await evColl.countDocuments();
  console.log(`  Total marketing_events: ${total}`);
  if (total === 0) { warn("Sin marketing events — se generarán con uso real del producto"); }
  if (total > 0) {
    const count = async (type) => evColl.countDocuments({ type });
    const [viewed, started, paid, regStarted, regCompleted, feedViews, feedClicks] = await Promise.all([
      count('boost_viewed'), count('boost_started'), count('boost_paid'),
      count('commerce_register_started'), count('commerce_register_completed'),
      count('commerce_feed_view'), count('commerce_feed_click'),
    ]);

    // Boost funnel invariants
    if (started <= viewed || viewed === 0)
      ok(`Boost funnel coherente: viewed=${viewed} started=${started} paid=${paid}`);
    else
      fail(`Boost funnel roto: started(${started}) > viewed(${viewed})`);

    if (paid <= started || started === 0)
      ok(`Boost paid ≤ started: paid=${paid} started=${started}`);
    else
      fail(`Boost paid(${paid}) > started(${started}) — imposible`);

    // Commerce funnel
    if (regCompleted <= regStarted || regStarted === 0)
      ok(`Commerce funnel coherente: started=${regStarted} completed=${regCompleted}`);
    else
      fail(`Commerce funnel roto: completed(${regCompleted}) > started(${regStarted})`);

    // CTR razonable
    if (feedViews > 0) {
      const ctr = feedClicks / feedViews * 100;
      if (ctr <= 100) ok(`Feed CTR razonable: ${ctr.toFixed(1)}% (${feedClicks}/${feedViews})`);
      else fail(`Feed CTR imposible: ${ctr.toFixed(1)}% — clicks > views`);
    } else {
      warn('Sin feed_view events aún — CTR no calculable');
    }
  } else {
    warn('Sin eventos — invariantes no evaluables todavía');
  }

  // ── D) Modelo Commerce ───────────────────────────────
  section('D) Modelo Commerce');
  const commerceColl = cols.find(c => c.toLowerCase().includes('commerce'));
  if (commerceColl) {
    const cColl = db.collection(commerceColl);
    const total = await cColl.countDocuments();
    console.log(`  Total comercios: ${total}`);

    const withBoost = await cColl.countDocuments({ is_boosted: true });
    const expiredBoost = await cColl.countDocuments({
      is_boosted: true,
      boost_expires_at: { $lt: new Date() }
    });

    ok(`Schema boost presente: ${withBoost} comercios boosted`);
    if (expiredBoost > 0)
      warn(`${expiredBoost} boost(s) vencidos sin limpiar — cron pendiente de correr`);
    else
      ok('Sin boosts vencidos sin limpiar');

    // Comercios sin campos requeridos
    const noEmail = await cColl.countDocuments({ email: { $exists: false } });
    noEmail === 0 ? ok('Todos los comercios tienen email') : warn(`${noEmail} comercios sin email`);
  } else {
    warn('Colección Commerce no encontrada — verificá el nombre');
  }

  // ── E) Payments ──────────────────────────────────────
  section('E) Payments');
  if (cols.includes('payments')) {
    const pColl = db.collection('payments');
    const pTotal = await pColl.countDocuments();
    console.log(`  Total payments: ${pTotal}`);

    const stuck = await pColl.countDocuments({
      status: 'PENDING',
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    stuck === 0
      ? ok('Sin payments PENDING de más de 24h')
      : warn(`${stuck} payments PENDING de más de 24h — revisar`);

    const dist = await pColl.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    console.log('  Distribución payments:');
    for (const d of dist) console.log(`    ${d._id}: ${d.count}`);
  } else {
    warn('Colección payments no encontrada');
  }

  // ── F) Variables de entorno críticas ─────────────────
  section('F) Variables de entorno');
  const envVars = [
    [process.env.MONGODB_URI ? 'MONGODB_URI' : 'MONGO_URI', '✅ conexión DB'],
    ['MP_ACCESS_TOKEN', '✅ Mercado Pago'],
    ['GROQ_API_KEY', '✅ Asistente IA'],
    ['JWT_SECRET', '✅ Auth'],
    ['ANALYTICS_KEY', '⚠️ Analytics protegido'],
    ['BASE_URL', '⚠️ URLs de retorno MP'],
  ];
  for (const [key, label] of envVars) {
    if (process.env[key]) ok(`${key} definida — ${label}`);
    else warn(`${key} no definida`);
  }

  // ── Resumen ──────────────────────────────────────────
  console.log('\n' + B('─── Resumen ───'));
  console.log(G(`  ✅ PASS: ${passed}`));
  console.log(Y(`  ⚠️  WARN: ${warned}`));
  console.log(R(`  ❌ FAIL: ${failed}`));

  const status = failed === 0 && warned <= 3 ? G('LISTO PARA PRODUCCIÓN') :
                 failed === 0 ? Y('PRODUCCIÓN CON ADVERTENCIAS') :
                 R('REQUIERE CORRECCIONES');
  console.log('\n  Estado: ' + status + '\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(R('Fatal: ' + e.message)); process.exit(1); });
