// ledgerPg.js — Ledger append-only con MongoDB (swap a Postgres: misma interfaz)
// Postgres schema equivalente:
//   CREATE TABLE ledger (id SERIAL, idempotency_key TEXT, entity_id TEXT,
//   causal_seq INT, event JSONB, decision TEXT, result JSONB, ts TIMESTAMPTZ DEFAULT NOW());
const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  idempotency_key: { type: String, required: true },
  entity_id:       { type: String, required: true },
  causal_seq:      { type: Number, required: true },
  event:           Object,
  decision:        String,
  result:          Object,
  ts:              { type: Date, default: Date.now },
}, { capped: false }); // NO capped — ledger es permanente

ledgerSchema.index({ entity_id: 1, causal_seq: 1 }, { unique: true });

const LedgerDoc = mongoose.models.SepLedger || mongoose.model('SepLedger', ledgerSchema);

async function append({ idempotency_key, entity_id, causal_seq, event, decision, result }) {
  try {
    const doc = await LedgerDoc.create({ idempotency_key, entity_id, causal_seq, event, decision, result });
    return doc.toObject();
  } catch (e) {
    if (e.code === 11000) return null; // ya existe, idempotente
    throw e;
  }
}

async function lastSeq(entity_id) {
  const doc = await LedgerDoc.findOne({ entity_id }).sort({ causal_seq: -1 }).lean();
  return doc?.causal_seq ?? -1;
}

async function history(entity_id) {
  return LedgerDoc.find({ entity_id }).sort({ causal_seq: 1 }).lean();
}

module.exports = { append, lastSeq, history };
