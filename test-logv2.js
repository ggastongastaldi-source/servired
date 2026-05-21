const mongoose = require('mongoose');
require('dotenv').config();
const { seal, replay, computeHash, SinapsisLogV2 } = require('./src/sinapsis/logManagerV2');

let OK = 0, FAIL = 0;
function assert(desc, cond) {
  if (cond) { console.log(`✅ ${desc}`); OK++; }
  else { console.error(`❌ ${desc}`); FAIL++; }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ MongoDB conectado\n');

  // Limpiar test anterior
  await SinapsisLogV2.deleteMany({ policy_id: 'test_chain' });

  const fakeEvent = (n) => ({
    eventId: require('crypto').randomUUID(),
    type: 'servired.order.created',
    domain: 'servired',
    payload: { total: n * 1000 },
    metadata: { source: 'test' }
  });

  const fakePolicy = (dec) => ({
    decision: dec, policy_id: 'test_chain',
    risk_score: 0.1, reason: ['test'], latencyMs: 10
  });

  // T1 — Sellar 3 eventos encadenados
  const e1 = await seal(fakeEvent(1), fakePolicy('EXECUTE'));
  const e2 = await seal(fakeEvent(2), fakePolicy('EXECUTE'));
  const e3 = await seal(fakeEvent(3), fakePolicy('HOLD'));
  assert('T1 — 3 eventos sellados', e1 && e2 && e3);

  // T2 — Chain válida (prevHash de e2 = entryHash de e1)
  assert('T2 — Chain e1→e2 válida', e2.prevHash === e1.entryHash);
  assert('T2 — Chain e2→e3 válida', e3.prevHash === e2.entryHash);

  // T3 — Hash reproducible
  const recomputed = computeHash(e1.toObject());
  assert('T3 — Hash reproducible sin memoria', recomputed === e1.entryHash);

  // T4 — Replay forense
  const health = await replay(e1.sequence);
  assert('T4 — Replay detecta chain válida', health.invalid === 0);
  assert('T4 — SHI > 0', parseFloat(health.shi) > 0);
  assert('T4 — Total >= 3', health.total >= 3);

  // T5 — Idempotencia
  const dup = await seal(
    { ...fakeEvent(1), eventId: e1.eventId },
    fakePolicy('EXECUTE')
  );
  assert('T5 — Duplicado no rompe chain', dup === null);

  console.log(`\n════════════════════════════════════`);
  console.log(`  ✅ OK: ${OK}  |  ❌ FAIL: ${FAIL}`);
  console.log(`  SHI forense: ${health.shi}% | Eventos: ${health.total}`);
  console.log(`════════════════════════════════════`);

  await mongoose.disconnect();
  if (FAIL > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
