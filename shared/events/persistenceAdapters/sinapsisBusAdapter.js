// sinapsisBusAdapter.js
// Adapter de persistencia para el EventBus nervioso central.
// Implementa BusPersistenceAdapter (ver BUS_PERSISTENCE_CONTRACT.md).
// Colección: sinapsis_bus_log (SEPARADA de sinapsis_log_v2).
// Patrón: hash-chain SHA-256, sequence atómica, append-only.

const crypto   = require('crypto');
const mongoose = require('mongoose');

// ── Atomic counter ──────────────────────────────────────────────
const CounterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
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

// ── Schema ──────────────────────────────────────────────────────
const BusLogSchema = new mongoose.Schema({
  eventId:       { type: String, required: true, unique: true },
  sequence:      { type: Number, required: true },
  eventType:     { type: String, required: true },
  correlationId: { type: String },
  causation:     { type: mongoose.Schema.Types.Mixed },
  actor:         { type: mongoose.Schema.Types.Mixed },
  context:       { type: mongoose.Schema.Types.Mixed },
  payload:       { type: mongoose.Schema.Types.Mixed },
  metadata:      { type: mongoose.Schema.Types.Mixed },
  // hash-chain
  prevHash:      { type: String, required: true },
  entryHash:     { type: String, required: true },
  sealedAt:      { type: Date,   required: true }
}, { collection: 'sinapsis_bus_log' });

BusLogSchema.index({ sequence: 1 }, { unique: true });
BusLogSchema.index({ eventId:  1 }, { unique: true });
BusLogSchema.index({ eventType: 1, sealedAt: -1 });

const SinapsisBusLog = mongoose.models.SinapsisBusLog ||
  mongoose.model('SinapsisBusLog', BusLogSchema);

// ── Hash ────────────────────────────────────────────────────────
function computeHash(entry) {
  const data = JSON.stringify({
    eventId:   entry.eventId,
    sequence:  entry.sequence,
    eventType: entry.eventType,
    payload:   entry.payload,
    prevHash:  entry.prevHash,
    sealedAt:  entry.sealedAt
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ── Adapter factory ─────────────────────────────────────────────
function createSinapsisBusAdapter(opts = {}) {
  const maxRetries = opts.maxRetries || 3;

  return {
    async persist(eventEnvelope) {
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
              stored_at:  sealedAt.toISOString(),
              entryHash:  entry.entryHash,
              prevHash,
              sealedAt:   sealedAt.toISOString()
            })
          });

        } catch (err) {
          if (err.code === 11000) {
            if (err.message.includes('eventId')) {
              console.warn(`[BUS_ADAPTER] Evento duplicado (idempotente): ${eventEnvelope.event_id}`);
              return null;
            }
            // race en sequence → retry
            console.warn(`[BUS_ADAPTER] Race en sequence, retry ${attempt + 1}/${maxRetries}`);
            await new Promise(r => setTimeout(r, 10 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
      throw new Error('[BUS_ADAPTER] Max retries alcanzado — sequence race no resuelta');
    },

    // utilidad de auditoría (no requerida por contrato)
    async getHead() {
      return SinapsisBusLog.findOne().sort({ sequence: -1 }).lean();
    }
  };
}

module.exports = { createSinapsisBusAdapter, SinapsisBusLog, computeHash };
