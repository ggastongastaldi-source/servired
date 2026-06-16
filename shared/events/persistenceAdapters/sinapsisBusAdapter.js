// sinapsisBusAdapter.js
// Adapter de persistencia para el EventBus nervioso central.
// Implementa BusPersistenceAdapter (ver BUS_PERSISTENCE_CONTRACT.md).
// Colección: sinapsis_bus_log (SEPARADA de sinapsis_log_v2).
// Patrón: hash-chain SHA-256, sequence atómica, append-only.
// v1.1: fix prevHash race (promise-chain mutex), fix índice duplicado,
//        sealedAt → ISO string explícito en hash para reproducibilidad.

const crypto   = require('crypto');
const mongoose = require('mongoose');

// ── Atomic counter ──────────────────────────────────────────────
const CounterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});
const BusCounter = mongoose.models.SinapsisBusCounter ||
  mongoose.model('SinapsisBusCounter', CounterSchema, 'sinapsis_bus_counters');

async function nextSeq() {
  const doc = await BusCounter.findOneAndUpdate(
    { _id: 'sinapsis_bus_log' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.seq;
}

// ── Schema — sin unique:true en campos, solo en index() ─────────
const BusLogSchema = new mongoose.Schema({
  eventId:       { type: String, required: true },   // unique via index()
  sequence:      { type: Number, required: true },   // unique via index()
  eventType:     { type: String, required: true },
  correlationId: { type: String },
  causation:     { type: mongoose.Schema.Types.Mixed },
  actor:         { type: mongoose.Schema.Types.Mixed },
  context:       { type: mongoose.Schema.Types.Mixed },
  payload:       { type: mongoose.Schema.Types.Mixed },
  metadata:      { type: mongoose.Schema.Types.Mixed },
  prevHash:      { type: String, required: true },
  entryHash:     { type: String, required: true },
  sealedAt:      { type: Date,   required: true }
}, { collection: 'sinapsis_bus_log' });

BusLogSchema.index({ sequence: 1  }, { unique: true });
BusLogSchema.index({ eventId:  1  }, { unique: true });
BusLogSchema.index({ eventType: 1, sealedAt: -1 });

const SinapsisBusLog = mongoose.models.SinapsisBusLog ||
  mongoose.model('SinapsisBusLog', BusLogSchema);

// ── Hash — sealedAt como ISO string explícito ───────────────────
// CRÍTICO: sealedAt debe ser string antes de JSON.stringify para
// garantizar que replay() produce el mismo hash que el original.
function computeHash(entry) {
  const sealedAtStr = entry.sealedAt instanceof Date
    ? entry.sealedAt.toISOString()
    : entry.sealedAt;

  const data = JSON.stringify({
    eventId:   entry.eventId,
    sequence:  entry.sequence,
    eventType: entry.eventType,
    payload:   entry.payload,
    prevHash:  entry.prevHash,
    sealedAt:  sealedAtStr
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ── busReplay — verifica integridad de sinapsis_bus_log ─────────
async function busReplay(fromSequence = 1) {
  const entries = await SinapsisBusLog
    .find({ sequence: { $gte: fromSequence } })
    .sort({ sequence: 1 })
    .lean();

  let prevHash = fromSequence === 1
    ? '0'.repeat(64)
    : (await SinapsisBusLog.findOne({ sequence: fromSequence - 1 }).lean())?.entryHash || '0'.repeat(64);

  let valid = 0, invalid = 0;
  const gaps = [];
  const broken = [];

  if (entries.length === 0) {
    return { total: 0, valid: 0, invalid: 0, gaps: [], broken: [], integrityOk: true };
  }

  let expectedSeq = fromSequence === 1 ? entries[0].sequence : fromSequence;

  for (const entry of entries) {
    if (entry.sequence !== expectedSeq) {
      for (let g = expectedSeq; g < entry.sequence; g++) gaps.push(g);
    }
    expectedSeq = entry.sequence + 1;

    const recomputed = computeHash(entry);
    const hashOk  = entry.entryHash === recomputed;
    const chainOk = entry.prevHash  === prevHash;

    if (hashOk && chainOk) {
      valid++;
    } else {
      invalid++;
      broken.push({
        sequence:  entry.sequence,
        eventId:   entry.eventId,
        hashOk,
        chainOk,
        expected:  recomputed.slice(0, 12),
        got:       entry.entryHash.slice(0, 12)
      });
    }

    prevHash = entry.entryHash;
  }

  return {
    total:       entries.length,
    valid,
    invalid,
    gaps,
    gapCount:    gaps.length,
    broken,
    integrityOk: invalid === 0 && gaps.length === 0
  };
}

// ── Adapter factory ─────────────────────────────────────────────
// Promise-chain mutex: serializa escrituras concurrentes dentro
// del mismo proceso. Elimina la race condition de prevHash sin
// necesidad de transacciones ni infraestructura adicional.
// Efectivo con WEB_CONCURRENCY=1 (Render free tier).
function createSinapsisBusAdapter(opts = {}) {
  const maxRetries = opts.maxRetries || 3;
  let writeChain = Promise.resolve(); // mutex in-process

  async function _doWrite(eventEnvelope) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const sequence = await nextSeq();
        const prev     = await SinapsisBusLog.findOne({ sequence: sequence - 1 }).lean();
        const prevHash = prev ? prev.entryHash : '0'.repeat(64);
        const sealedAt = new Date();

        const entry = {
          eventId:       eventEnvelope.event_id,
          sequence,
          eventType:     eventEnvelope.event_type,
          correlationId: eventEnvelope.correlation_id,
          causation:     eventEnvelope.causation,
          actor:         eventEnvelope.actor,
          context:       eventEnvelope.context,
          payload:       eventEnvelope.payload,
          metadata:      eventEnvelope.metadata,
          prevHash,
          sealedAt
        };

        entry.entryHash = computeHash(entry);

        await SinapsisBusLog.create(entry);

        return Object.freeze({
          event: eventEnvelope,
          persistence: Object.freeze({
            sequence,
            stored_at: sealedAt.toISOString(),
            entryHash: entry.entryHash,
            prevHash,
            sealedAt:  sealedAt.toISOString()
          })
        });

      } catch (err) {
        if (err.code === 11000) {
          if (err.message.includes('eventId')) {
            console.warn(`[BUS_ADAPTER] Duplicado idempotente: ${eventEnvelope.event_id}`);
            return null;
          }
          console.warn(`[BUS_ADAPTER] Race en sequence, retry ${attempt + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, 10 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('[BUS_ADAPTER] Max retries alcanzado');
  }

  return {
    persist(eventEnvelope) {
      // Encadenar en el mutex — cada escritura espera a la anterior
      writeChain = writeChain
        .then(() => _doWrite(eventEnvelope))
        .catch(err => { throw err; });
      return writeChain;
    },

    async getHead() {
      return SinapsisBusLog.findOne().sort({ sequence: -1 }).lean();
    }
  };
}

module.exports = { createSinapsisBusAdapter, SinapsisBusLog, computeHash, busReplay };
