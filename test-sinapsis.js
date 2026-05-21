const mongoose = require('mongoose');
require('dotenv').config();
const { dixieGate, logManager } = require('./src/sinapsis');

let OK = 0, FAIL = 0;
function assert(desc, cond) {
  if (cond) { console.log(`✅ ${desc}`); OK++; }
  else       { console.error(`❌ ${desc}`); FAIL++; }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ MongoDB conectado\n');

  // T1 — Evento válido EXECUTE
  const r1 = await dixieGate.ingest(
    'servired.order.created',
    { total: 150000, rubro: 'plomeria' },
    { source: 'test', node: 'termux' }
  );
  assert('T1 — order.created → EXECUTE', r1.decision.decision === 'EXECUTE');

  // T2 — Evento REJECT (monto 0)
  const r2 = await dixieGate.ingest(
    'servired.order.created',
    { total: 0 },
    { source: 'test' }
  );
  assert('T2 — order.created total=0 → REJECT', r2.decision.decision === 'REJECT');

  // T3 — Pago aprobado
  const r3 = await dixieGate.ingest(
    'servired.order.paid',
    { paymentStatus: 'approved', amount: 150000 },
    { source: 'mercadopago' }
  );
  assert('T3 — order.paid approved → EXECUTE', r3.decision.decision === 'EXECUTE');

  // T4 — Pago pendiente → HOLD
  const r4 = await dixieGate.ingest(
    'servired.order.paid',
    { paymentStatus: 'pending' },
    { source: 'mercadopago' }
  );
  assert('T4 — order.paid pending → HOLD', r4.decision.decision === 'HOLD');

  // T5 — Stock crítico → ESCALATE
  const r5 = await dixieGate.ingest(
    'grove.stock.updated',
    { sku: 'BOBINA-001', available: 1 },
    { source: 'grove', domain: 'grove' }
  );
  assert('T5 — stock crítico → ESCALATE', r5.decision.decision === 'ESCALATE');

  // T6 — Executor real
  let executed = false;
  const r6 = await dixieGate.ingest(
    'servired.order.created',
    { total: 200000 },
    { source: 'test' },
    async (event) => { executed = true; return { ok: true }; }
  );
  assert('T6 — Executor llamado en EXECUTE', executed === true);

  // T7 — Health del sistema
  const health = await logManager.getHealth();
  assert('T7 — SHI calculado', health.shi !== undefined);
  assert('T7 — Log tiene eventos', health.total >= 5);

  // T8 — Idempotencia (evento duplicado no rompe)
  try {
    await dixieGate.ingest('servired.order.created', { total: 150000 }, { source: 'test' });
    assert('T8 — Eventos duplicados no rompen el sistema', true);
  } catch(e) {
    assert('T8 — Eventos duplicados no rompen el sistema', false);
  }

  console.log(`\n════════════════════════════════════`);
  console.log(`  ✅ OK: ${OK}  |  ❌ FAIL: ${FAIL}`);
  console.log(`  SHI: ${health.shi}% | Eventos: ${health.total}`);
  console.log(`════════════════════════════════════`);

  await mongoose.disconnect();
  if (FAIL > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
