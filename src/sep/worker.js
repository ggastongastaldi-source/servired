// worker.js — consumer distribuido SEP-v1
// Dixie worker + Runtime worker en el mismo proceso (separar por env si escala)
const idempotency = require('./idempotency');
const ledgerPg    = require('./ledgerPg');
const streams     = require('./streams');
const dixie       = require('../sinapsis/dixie');
const runtime     = require('../sinapsis/runtime');
const eye         = require('../sinapsis/eye');

const GROUP       = process.env.WORKER_GROUP || 'sep-workers';
const STREAM      = 'sep:events';
const DLQ_STREAM  = 'sep:dlq';
const MAX_ATTEMPTS = 3;
const POLL_MS      = 1000;

async function processOne(doc) {
  const raw   = doc.event;
  const key   = raw.idempotency_key;
  const eid   = raw.entity_id;
  const seq   = raw.causal_seq;

  // 1) idempotencia — acquire lock
  const { acquired, existing } = await idempotency.acquire(key);
  if (!acquired) {
    if (existing.status === 'DONE') return { skipped: true, reason: 'already_done' };
    return { skipped: true, reason: `in_flight:${existing.status}` };
  }

  // 2) causal ordering — rechazar si seq rompe orden
  const lastSeq = await ledgerPg.lastSeq(eid);
  if (seq !== lastSeq + 1) {
    await idempotency.markDone(key, { error: 'causal_order_violation' });
    return { skipped: true, reason: `causal_violation: expected ${lastSeq+1} got ${seq}` };
  }

  // 3) Dixie decide
  await idempotency.markProcessing(key);
  const decision = dixie.evaluate(raw);

  // 4) Runtime ejecuta si ALLOW
  let result;
  if (decision === 'ALLOW') {
    result = await runtime.execute(raw);
  } else {
    result = { status: 'SKIPPED', reason: decision };
  }

  // 5) Ledger append — idempotente por unique index
  await ledgerPg.append({ idempotency_key: key, entity_id: eid, causal_seq: seq, event: raw, decision, result });

  // 6) marcar DONE
  await idempotency.markDone(key, result);

  // 7) Eye
  eye.emit(raw, decision, result);

  return { decision, result };
}

async function poll() {
  const docs = await streams.consume(STREAM, GROUP);

  for (const doc of docs) {
    try {
      await processOne(doc);
      await streams.ack(doc._id, GROUP);
    } catch (e) {
      await streams.nack(doc._id);
      if (doc.attempts + 1 >= MAX_ATTEMPTS) {
        await streams.publish(DLQ_STREAM, { original: doc.event, error: e.message, attempts: doc.attempts + 1 });
        await streams.ack(doc._id, GROUP); // sacar del stream principal
        console.error(`[Worker] ☠️  DLQ: ${doc.event?.idempotency_key} — ${e.message}`);
      } else {
        console.error(`[Worker] ⚠️  retry ${doc.attempts+1}/${MAX_ATTEMPTS}: ${e.message}`);
      }
    }
  }
}

async function start() {
  const mongoose = require('mongoose');
  const fs       = require('fs'), path = require('path');
  const envPath  = path.join(__dirname, '../../.env');
  if (!process.env.MONGO_URI && require('fs').existsSync(envPath)) {
    require('fs').readFileSync(envPath,'utf8').split('\n').filter(l=>l&&l[0]!=='#').forEach(l=>{
      const i=l.indexOf('='); if(i>0) process.env[l.slice(0,i)]=l.slice(i+1);
    });
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`[Worker] 🚀 SEP-v1 worker arriba — group=${GROUP} stream=${STREAM}`);
  setInterval(poll, POLL_MS);
}

start().catch(err => { console.error(err); process.exit(1); });
