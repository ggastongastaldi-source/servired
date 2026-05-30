// ServiRed — Outbox Pattern v2.0
// DOMAIN EVENT → OUTBOX → DISPATCHER → PROVIDER
// Sprint B: findOneAndUpdate atómico — elimina race condition

const mongoose = require('mongoose');
const crypto = require('crypto');

const STATUS = {
  PENDING:     'PENDING',
  DISPATCHING: 'DISPATCHING',
  SENT:        'SENT',
  FAILED:      'FAILED',
  DEAD_LETTER: 'DEAD_LETTER',
};

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000];

function makeDispatchId(workflowId, logicalStep, channel, template) {
  return crypto.createHash('sha256')
    .update(`${workflowId}:${logicalStep}:${channel}:${template}`)
    .digest('hex').slice(0, 32);
}

async function enqueue({ workflowId, logicalStep, channel, template, payload, correlationId }) {
  const dispatchId = makeDispatchId(workflowId, logicalStep, channel, template);
  const col = mongoose.connection.collection('outbox');

  try {
    const entry = {
      dispatchId,
      workflowId,
      logicalStep,
      channel,
      template,
      payload,
      correlationId: correlationId || crypto.randomUUID(),
      status: STATUS.PENDING,
      retries: 0,
      createdAt: new Date(),
      scheduledAt: new Date(),
      sentAt: null,
      error: null,
    };
    await col.insertOne(entry);
    console.log(`[Outbox] 📥 Encolado: ${channel}/${template} → ${dispatchId}`);
    return { dispatchId, duplicate: false, status: STATUS.PENDING };
  } catch (e) {
    if (e.code === 11000) {
      // índice único rechazó el duplicado — idempotencia garantizada por Mongo
      const existing = await col.findOne({ dispatchId });
      console.log(`[Outbox] ⚡ Ya encolado: ${dispatchId} (${existing?.status})`);
      return { dispatchId, duplicate: true, status: existing?.status };
    }
    throw e;
  }
}

async function dispatch(handlers = {}) {
  const col = mongoose.connection.collection('outbox');
  const now = new Date();
  let processed = 0;

  // Loop atómico: procesa uno por vez hasta que no haya más pendientes
  while (true) {
    // findOneAndUpdate atómico — lock garantizado por Mongo
    const result = await col.findOneAndUpdate(
      {
        status: { $in: [STATUS.PENDING, STATUS.FAILED] },
        scheduledAt: { $lte: now },
        retries: { $lt: MAX_RETRIES },
      },
      { $set: { status: STATUS.DISPATCHING, dispatchingAt: new Date() } },
      { returnDocument: 'before', sort: { scheduledAt: 1 } }
    );

    const entry = result?.value ?? result;
    if (!entry) break; // no hay más pendientes

    processed++;

    try {
      const handler = handlers[entry.channel];
      if (!handler) throw new Error(`Sin handler para canal: ${entry.channel}`);

      await handler(entry.template, entry.payload);

      await col.updateOne(
        { dispatchId: entry.dispatchId },
        { $set: { status: STATUS.SENT, sentAt: new Date(), error: null } }
      );
      console.log(`[Outbox] ✅ SENT: ${entry.channel}/${entry.template}`);

    } catch (e) {
      const nextRetry = entry.retries + 1;
      const isDeadLetter = nextRetry >= MAX_RETRIES;
      const delay = RETRY_DELAYS[Math.min(nextRetry - 1, RETRY_DELAYS.length - 1)];

      await col.updateOne(
        { dispatchId: entry.dispatchId },
        { $set: {
          status: isDeadLetter ? STATUS.DEAD_LETTER : STATUS.FAILED,
          retries: nextRetry,
          error: e.message,
          scheduledAt: new Date(Date.now() + delay),
        }}
      );
      console.error(`[Outbox] ❌ FAILED (${nextRetry}/${MAX_RETRIES}): ${entry.channel}/${entry.template} — ${e.message}`);
    }
  }

  if (processed > 0) console.log(`[Outbox] 🚀 Procesados: ${processed} mensajes`);
}

async function recover() {
  const col = mongoose.connection.collection('outbox');
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

  const stale = await col.updateMany(
    { status: STATUS.DISPATCHING, dispatchingAt: { $lt: staleThreshold } },
    { $set: { status: STATUS.FAILED, error: 'recovered_from_crash' } }
  );

  if (stale.modifiedCount > 0) {
    console.log(`[Outbox] 🔄 Recovery: ${stale.modifiedCount} mensajes huérfanos → FAILED`);
  }
}

async function stats() {
  const col = mongoose.connection.collection('outbox');
  const result = await col.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  return result.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {});
}

module.exports = { enqueue, dispatch, recover, stats, makeDispatchId, STATUS };
