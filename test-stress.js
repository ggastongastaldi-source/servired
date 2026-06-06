const mongoose = require('mongoose');
const { emitJobEvent } = require('./src/engine/eventEngine');
require('dotenv').config();

let OK = 0, FAIL = 0;

function assert(desc, cond) {
  if (cond) { console.log(`✅ ${desc}`); OK++; }
  else       { console.error(`❌ ${desc}`); FAIL++; }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ MongoDB conectado');

  const Pedido = mongoose.model('Pedido', require('./src/core/models/Pedido').schema);

  // Crear pedido de prueba
  const job = await Pedido.create({
    cliente:      new mongoose.Types.ObjectId(),
    tipoServicio: 'pintura',
    zona:         'palermo',
    total_estimado: 180000,
    ubicacion: { type: 'Point', coordinates: [-58.3816, -34.6037] }
  });
  const jobId = job._id;
  console.log(`\n📋 Job creado: ${jobId}\n`);

  // ── TEST 1: Transición válida ─────────────────────────────────────────────
  const r1 = await emitJobEvent(jobId, { type: 'BUSQUEDA_INICIADA', source: 'TEST', idempotencyKey: 'test:busqueda:1' });
  assert('T1 — BUSQUEDA_INICIADA acepta desde PENDIENTE', r1.ok && r1.estado === 'SEARCHING');

  // ── TEST 2: Idempotencia — mismo key, debe rechazar ───────────────────────
  const r2 = await emitJobEvent(jobId, { type: 'BUSQUEDA_INICIADA', source: 'TEST', idempotencyKey: 'test:busqueda:1' });
  assert('T2 — Duplicado con mismo idempotencyKey rechazado', !r2.ok && r2.reason === 'FSM_REJECTED_OR_DUPLICATE');

  // ── TEST 3: Concurrencia — 3 requests simultáneos ────────────────────────
  const workerId = new mongoose.Types.ObjectId();
  const results = await Promise.all([
    emitJobEvent(jobId, { type: 'WORKER_ASIGNADO', source: 'TEST', idempotencyKey: 'test:asignado:concurrent', metadata: { workerId } }),
    emitJobEvent(jobId, { type: 'WORKER_ASIGNADO', source: 'TEST', idempotencyKey: 'test:asignado:concurrent', metadata: { workerId } }),
    emitJobEvent(jobId, { type: 'WORKER_ASIGNADO', source: 'TEST', idempotencyKey: 'test:asignado:concurrent', metadata: { workerId } })
  ]);
  const wins = results.filter(r => r.ok).length;
  const rejects = results.filter(r => !r.ok).length;
  assert('T3 — Concurrencia: solo 1 success de 3', wins === 1);
  assert('T3 — Concurrencia: 2 rechazados', rejects === 2);

  // ── TEST 4: FSM fuera de orden — PAGO antes de REALIZADA ─────────────────
  const r4 = await emitJobEvent(jobId, { type: 'PAGO_APROBADO', source: 'TEST', idempotencyKey: 'test:pago:early' });
  assert('T4 — PAGO_APROBADO rechazado si no está REALIZADA', !r4.ok);

  // ── TEST 5: Flujo completo ────────────────────────────────────────────────
  const r5a = await emitJobEvent(jobId, { type: 'TRABAJO_INICIADO',  source: 'TEST', idempotencyKey: 'test:inicio:1' });
  const r5b = await emitJobEvent(jobId, { type: 'TRABAJO_REALIZADO', source: 'TEST', idempotencyKey: 'test:realizado:1' });
  const r5c = await emitJobEvent(jobId, { type: 'PAGO_APROBADO',     source: 'TEST', idempotencyKey: 'test:pago:1', metadata: { paymentId: 'mp_test_123', monto: 180000 } });
  assert('T5 — TRABAJO_INICIADO OK',  r5a.ok && r5a.estado === 'EN_PROCESO');
  assert('T5 — TRABAJO_REALIZADO OK', r5b.ok && r5b.estado === 'REALIZADA');
  assert('T5 — PAGO_APROBADO OK',     r5c.ok && r5c.estado === 'PAGADA');

  // ── TEST 6: Timeline inmutable ────────────────────────────────────────────
  const jobFinal = await Pedido.findById(jobId).lean();
  assert('T6 — Timeline tiene 5 eventos', jobFinal.timeline.length === 5);
  const keys = jobFinal.timeline.map(e => e.idempotencyKey);
  const uniqueKeys = new Set(keys);
  assert('T6 — Todos los idempotencyKeys son únicos', keys.length === uniqueKeys.size);

  // ── TEST 7: Estado final correcto ─────────────────────────────────────────
  assert('T7 — Estado final es PAGADA', jobFinal.estado === 'PAGADA');

  // Cleanup
  await Pedido.deleteOne({ _id: jobId });

  console.log(`\n════════════════════════════════════`);
  console.log(`  ✅ OK: ${OK}  |  ❌ FAIL: ${FAIL}`);
  console.log(`════════════════════════════════════`);

  await mongoose.disconnect();
  if (FAIL > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
