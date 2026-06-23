'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGODB_URI no definida'); process.exit(1); }

const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;

let passed = 0, warned = 0, failed = 0;
function ok(msg)   { console.log(G('  PASS ') + msg); passed++; }
function warn(msg) { console.log(Y('  WARN ') + msg); warned++; }
function fail(msg) { console.log(R('  FAIL ') + msg); failed++; }
function section(t){ console.log('\n' + B('--- ' + t + ' ---')); }

async function run() {
  console.log(B('\nServiRed — System Audit Run'));
  console.log('  ' + new Date().toISOString());
  await mongoose.connect(MONGO_URI);
  ok('MongoDB conectado');
  const db = mongoose.connection.db;
  const cols = (await db.listCollections().toArray()).map(c => c.name);

  // A) Colecciones core
  section('A) Colecciones core');
  for (const c of ['commerces','payments','usuarios','events']) {
    cols.includes(c) ? ok(`'${c}' existe`) : warn(`'${c}' no encontrada`);
  }

  // B) SINAPSIS event bus
  section('B) SINAPSIS event bus');
  const sinCol = db.collection('events');
  const sinTotal = await sinCol.countDocuments();
  console.log(`  Total eventos SINAPSIS: ${sinTotal}`);
  if (sinTotal === 0) {
    warn('SINAPSIS bus vacío');
  } else {
    const sample = await sinCol.findOne();
    sample && sample.timestamp ? ok('Campo timestamp presente') : warn('Sin timestamp en eventos SINAPSIS');
    const dist = await sinCol.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 }
    ]).toArray();
    console.log('  Top tipos:', dist.map(d => `${d._id}:${d.count}`).join(', '));
    ok(`SINAPSIS bus activo — ${sinTotal} eventos`);
  }

  // B2) Marketing events
  section('B2) Marketing events (analytics)');
  const mktCol = db.collection('marketing_events');
  const mktTotal = await mktCol.countDocuments();
  console.log(`  Total marketing_events: ${mktTotal}`);
  if (mktTotal === 0) {
    warn('Sin marketing events — se generarán con uso real del producto');
  } else {
    const noType = await mktCol.countDocuments({ type: { $exists: false } });
    noType === 0 ? ok('Todos los eventos tienen type') : fail(`${noType} eventos sin type`);
    const noTs = await mktCol.countDocuments({ createdAt: { $exists: false } });
    noTs === 0 ? ok('Todos los eventos tienen createdAt') : fail(`${noTs} eventos sin createdAt`);
    const dist = await mktCol.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('  Distribución:', dist.map(d => `${d._id}:${d.count}`).join(', '));
    const since24h = new Date(Date.now() - 86400000);
    const recent = await mktCol.countDocuments({ createdAt: { $gte: since24h } });
    recent > 0 ? ok(`${recent} eventos en últimas 24h`) : warn('Sin eventos en últimas 24h');
  }

  // C) Invariantes de métricas
  section('C) Invariantes de métricas');
  if (mktTotal > 0) {
    const ct = async t => mktCol.countDocuments({ type: t });
    const [viewed, started, paid, regS, regC, fv, fc] = await Promise.all([
      ct('boost_viewed'), ct('boost_started'), ct('boost_paid'),
      ct('commerce_register_started'), ct('commerce_register_completed'),
      ct('commerce_feed_view'), ct('commerce_feed_click'),
    ]);
    (started <= viewed || viewed === 0)
      ? ok(`Boost funnel coherente: viewed=${viewed} started=${started} paid=${paid}`)
      : fail(`Boost funnel roto: started(${started}) > viewed(${viewed})`);
    (paid <= started || started === 0)
      ? ok(`Boost paid <= started OK`)
      : fail(`Boost paid(${paid}) > started(${started})`);
    (regC <= regS || regS === 0)
      ? ok(`Commerce funnel coherente: started=${regS} completed=${regC}`)
      : fail(`Commerce funnel roto: completed(${regC}) > started(${regS})`);
    if (fv > 0) {
      const ctr = fc / fv * 100;
      ctr <= 100 ? ok(`Feed CTR: ${ctr.toFixed(1)}% (${fc}/${fv})`) : fail(`Feed CTR imposible: ${ctr.toFixed(1)}%`);
    } else {
      warn('Sin feed_view events aún');
    }
  } else {
    warn('Sin marketing events — invariantes no evaluables');
  }

  // D) Modelo Commerce
  section('D) Modelo Commerce');
  const comCol = db.collection('commerces');
  const comTotal = await comCol.countDocuments();
  console.log(`  Total comercios: ${comTotal}`);
  const boosted = await comCol.countDocuments({ is_boosted: true });
  const expiredBoost = await comCol.countDocuments({ is_boosted: true, boost_expires_at: { $lt: new Date() } });
  ok(`Schema boost presente: ${boosted} comercios boosted`);
  expiredBoost > 0 ? warn(`${expiredBoost} boost(s) vencidos sin limpiar`) : ok('Sin boosts vencidos');
  const noEmail = await comCol.countDocuments({ email: { $exists: false } });
  noEmail === 0 ? ok('Todos los comercios tienen email') : warn(`${noEmail} comercios sin email`);

  // E) Payments
  section('E) Payments');
  const payCol = db.collection('payments');
  const payTotal = await payCol.countDocuments();
  console.log(`  Total payments: ${payTotal}`);
  const stuck = await payCol.countDocuments({ status: 'PENDING', createdAt: { $lt: new Date(Date.now() - 86400000) } });
  const stale = await payCol.countDocuments({ stale: true });
  stuck === 0 ? ok('Sin payments PENDING >24h') : warn(`${stuck} payments PENDING >24h`);
  stale > 0 ? warn(`${stale} payments marcados stale — verificar en MP`) : ok('Sin payments stale pendientes');
  const pdist = await payCol.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
  console.log('  Distribución:', pdist.map(d => `${d._id}:${d.count}`).join(', '));

  // F) Variables de entorno
  section('F) Variables de entorno');
  const envKey = process.env.MONGODB_URI ? 'MONGODB_URI' : 'MONGO_URI';
  for (const [k, label] of [
    [envKey, 'conexión DB'],
    ['MP_ACCESS_TOKEN', 'Mercado Pago'],
    ['GROQ_API_KEY', 'Asistente IA'],
    ['JWT_SECRET', 'Auth'],
    ['ANALYTICS_KEY', 'Analytics key'],
    ['BASE_URL', 'URLs MP retorno'],
  ]) {
    process.env[k] ? ok(`${k} — ${label}`) : warn(`${k} no definida`);
  }

  // Resumen
  console.log('\n' + B('--- Resumen ---'));
  console.log(G(`  PASS: ${passed}`));
  console.log(Y(`  WARN: ${warned}`));
  console.log(R(`  FAIL: ${failed}`));
  const status = failed === 0 && warned <= 3 ? G('LISTO PARA PRODUCCION') :
                 failed === 0 ? Y('PRODUCCION CON ADVERTENCIAS') : R('REQUIERE CORRECCIONES');
  console.log('\n  Estado: ' + status + '\n');
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(R('Fatal: ' + e.message)); process.exit(1); });
