// ServiRed — Outbox Pattern v1.0
// DOMAIN EVENT → OUTBOX → DISPATCHER → PROVIDER
// Nunca enviar mensajes directo desde lógica de dominio.

const mongoose = require('mongoose');
const crypto = require('crypto');

// Estados del Outbox según prompt maestro
const STATUS = {
  PENDING:      'PENDING',
  DISPATCHING:  'DISPATCHING',
  ACK_PENDING:  'ACK_PENDING',
  SENT:         'SENT',
  FAILED:       'FAILED',
  DEAD_LETTER:  'DEAD_LETTER',
};

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // backoff exponencial

// dispatchId determinístico — nunca duplicar
function makeDispatchId(workflowId, logicalStep, channel, template) {
  return crypto.createHash('sha256')
    .update(`${workflowId}:${logicalStep}:${channel}:${template}`)
    .digest('hex').slice(0, 32);
}

// Encolar mensaje en outbox — persiste ANTES de enviar
async function enqueue({ workflowId, logicalStep, channel, template, payload, correlationId }) {
  const dispatchId = makeDispatchId(workflowId, logicalStep, channel, template);
  const col = mongoose.connection.collection('outbox');

  // Idempotencia: si ya existe este dispatchId, no duplicar
  const existing = await col.findOne({ dispatchId });
  if (existing) {
    console.log(`[Outbox] ⚡ Ya encolado: ${dispatchId} (${existing.status})`);
    return { dispatchId, duplicate: true, status: existing.status };
  }

  const entry = {
    dispatchId,
    workflowId,
    logicalStep,
    channel,       // 'email' | 'socket' | 'mercadopago' | 'push'
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
}

// Dispatcher — procesa PENDING del outbox
async function dispatch(handlers = {}) {
  const col = mongoose.connection.collection('outbox');
  const now = new Date();

  const pending = await col.find({
    status: { $in: [STATUS.PENDING, STATUS.FAILED] },
    scheduledAt: { $lte: now },
    retries: { $lt: MAX_RETRIES },
  }).limit(20).toArray();

  if (!pending.length) return;

  console.log(`[Outbox] 🚀 Procesando ${pending.length} mensajes pendientes`);

  for (const entry of pending) {
    // Marcar como DISPATCHING (lock optimista)
    await col.updateOne(
      { dispatchId: entry.dispatchId, status: { $in: [STATUS.PENDING, STATUS.FAILED] } },
      { $set: { status: STATUS.DISPATCHING, dispatchingAt: new Date() } }
    );

    try {
      const handler = handlers[entry.channel];
      if (!handler) throw new Error(`Sin handler para canal: ${entry.channel}`);

      await handler(entry.template, entry.payload);

      // Éxito → ACK_PENDING → SENT
      await col.updateOne(
        { dispatchId: entry.dispatchId },
        { $set: { status: STATUS.SENT, sentAt: new Date(), error: null } }
      );
      console.log(`[Outbox] ✅ SENT: ${entry.channel}/${entry.template}`);

    } catch(e) {
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
}

// Recovery — reconcilia mensajes DISPATCHING viejos (huérfanos por crash)
async function recover() {
  const col = mongoose.connection.collection('outbox');
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 min

  const stale = await col.updateMany(
    { status: STATUS.DISPATCHING, dispatchingAt: { $lt: staleThreshold } },
    { $set: { status: STATUS.FAILED, error: 'recovered_from_crash' } }
  );

  if (stale.modifiedCount > 0) {
    console.log(`[Outbox] 🔄 Recovery: ${stale.modifiedCount} mensajes huérfanos → FAILED`);
  }
}

// Stats
async function stats() {
  const col = mongoose.connection.collection('outbox');
  const result = await col.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  return result.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {});
}

module.exports = { enqueue, dispatch, recover, stats, makeDispatchId, STATUS };
