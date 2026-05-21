// SINAPSIS LogManager v2.0
// Append-only + SHA-256 hash chaining + replay engine

const crypto = require('crypto');
const mongoose = require('mongoose');

// Schema con hash chaining
// Atomic counter para sequence — elimina race condition
const CounterSchema = new mongoose.Schema({
  _id:     { type: String, required: true },
  seq:     { type: Number, default: 0 }
});
const Counter = mongoose.models.SinapsisCounter ||
  mongoose.model('SinapsisCounter', CounterSchema);

async function nextSequence() {
  const doc = await Counter.findOneAndUpdate(
    { _id: 'sinapsis_log_v2' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.seq;
}

const SinapsisLogV2Schema = new mongoose.Schema({
  eventId:      { type: String, required: true, unique: true },
  sequence:     { type: Number, required: true },
  type:         { type: String, required: true },
  domain:       { type: String, required: true },
  decision:     { type: String, enum: ['EXECUTE','HOLD','REJECT','ESCALATE','FAILED'] },
  policy_id:    { type: String },
  risk_score:   { type: Number, default: 0 },
  reason:       [{ type: String }],
  payload:      { type: mongoose.Schema.Types.Mixed },
  metadata:     { type: mongoose.Schema.Types.Mixed },
  status:       { type: String, enum: ['PENDING','PROCESSED','FAILED'], default: 'PROCESSED' },
  latencyMs:    { type: Number },
  // Hash chain
  entryHash:    { type: String, required: true }, // SHA-256 de este evento
  prevHash:     { type: String, required: true }, // hash del evento anterior
  chainValid:   { type: Boolean, default: true },
  sealedAt:     { type: Date, default: Date.now }
}, { collection: 'sinapsis_log_v2' });

SinapsisLogV2Schema.index({ sequence: 1 }, { unique: true });
SinapsisLogV2Schema.index({ eventId: 1 }, { unique: true });
SinapsisLogV2Schema.index({ domain: 1, sealedAt: -1 });

const SinapsisLogV2 = mongoose.models.SinapsisLogV2 ||
  mongoose.model('SinapsisLogV2', SinapsisLogV2Schema);

function computeHash(entry) {
  const data = JSON.stringify({
    eventId:   entry.eventId,
    sequence:  entry.sequence,
    type:      entry.type,
    decision:  entry.decision,
    payload:   entry.payload,
    prevHash:  entry.prevHash,
    sealedAt:  entry.sealedAt
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function seal(event, policyResult, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    // Sequence atómica — sin race condition
    const sequence = await nextSequence();
    const last = await SinapsisLogV2.findOne({ sequence: sequence - 1 }).lean();
    const prevHash = last ? last.entryHash : '0'.repeat(64);
    // sealedAt fijo ANTES del hash para garantizar reproducibilidad
    const sealedAt = new Date();

    const entry = {
      eventId:   event.eventId,
      sequence,
      type:      event.type,
      domain:    event.domain || 'unknown',
      decision:  policyResult.decision,
      policy_id: policyResult.policy_id,
      risk_score: policyResult.risk_score,
      reason:    policyResult.reason,
      payload:   event.payload,
      metadata:  event.metadata,
      status:    'PROCESSED',
      latencyMs: policyResult.latencyMs,
      prevHash,
      sealedAt
    };

    // Hash computado con sealedAt fijo — reproducible en replay
    entry.entryHash = computeHash(entry);

    const saved = await SinapsisLogV2.create(entry);

    console.log(JSON.stringify({
      level: 'info', source: 'LOG_MANAGER_V2',
      eventId: event.eventId, sequence,
      hash: entry.entryHash.slice(0, 12) + '...',
      decision: policyResult.decision, sealed: true
    }));

    return saved;

  } catch (err) {
    if (err.code === 11000) {
      // Duplicate eventId — idempotente
      if (err.message.includes('eventId')) { console.warn(`[LOG_MANAGER_V2] Evento duplicado: ${event.eventId}`); return null; }
      // Duplicate sequence — race condition, retry
      console.warn(`[LOG_MANAGER_V2] Race en sequence, retry ${attempt+1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, 10 * (attempt+1)));
      continue;
    }
    throw err;
  }
  } // end retry loop
  throw new Error('[LOG_MANAGER_V2] Max retries alcanzado — sequence race no resuelta');
}

// Replay — reconstruye SHI desde historia sin memoria
async function replay(fromSequence = 1) {
  const entries = await SinapsisLogV2.find({ sequence: { $gte: fromSequence } })
    .sort({ sequence: 1 }).lean();

  let prevHash = fromSequence === 1 ? '0'.repeat(64) :
    (await SinapsisLogV2.findOne({ sequence: fromSequence - 1 }).lean())?.entryHash || '0'.repeat(64);

  let valid = 0, invalid = 0, failed = 0, rejected = 0, escalated = 0;
  const gaps = [];
  let expectedSeq = fromSequence;

  for (const entry of entries) {
    // Detección de gaps — sequence counter avanzó pero log vacío
    if (entry.sequence !== expectedSeq) {
      for (let g = expectedSeq; g < entry.sequence; g++) {
        gaps.push(g);
        console.error(`[REPLAY] GAP detectado en sequence ${g} — posible crash entre counter y create`);
      }
    }
    expectedSeq = entry.sequence + 1;

    const expectedHash = computeHash(entry);
    const chainOk = entry.entryHash === expectedHash && entry.prevHash === prevHash;

    if (!chainOk) {
      invalid++;
      console.error(`[REPLAY] Chain rota en sequence ${entry.sequence} — hash esperado: ${expectedHash.slice(0,12)}... got: ${entry.entryHash.slice(0,12)}...`);
    } else {
      valid++;
    }

    if (entry.decision === 'FAILED')   failed++;
    if (entry.decision === 'REJECT')   rejected++;
    if (entry.decision === 'ESCALATE') escalated++;

    prevHash = entry.entryHash;
  }

  const total = entries.length;
  const shi = total > 0 ? (((total - failed - invalid) / total) * 100).toFixed(1) : 100;

  return { total, valid, invalid, failed, rejected, escalated, gaps, gapCount: gaps.length, shi, fromSequence, integrityOk: invalid === 0 && gaps.length === 0 };
}

async function getHealth() {
  return replay(1);
}


async function getHeadIntegrity() {
  const last = await SinapsisLogV2.findOne().sort({ sequence: -1 }).lean();
  if (!last) return { valid: true, tip: "0x0000", sequence: 0 };
  const recomputed = computeHash(last);
  return {
    valid: recomputed === last.entryHash,
    tip: last.entryHash.slice(0, 10),
    sequence: last.sequence
  };
}

module.exports = { seal, replay, getHealth, SinapsisLogV2, computeHash, getHeadIntegrity
};
