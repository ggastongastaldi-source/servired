const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  transaction_id:          { type: String, required: true, index: true },
  provider_transaction_id: { type: String },
  order_id:                { type: String, required: true },
  account:                 { type: String, required: true, enum: [
    'ESCROW_PLATFORM',
    'WORKER_PENDING',
    'WORKER_AVAILABLE',
    'SERVIRED_REVENUE',
    // Cuentas de Comercio — T-502 wallet semántico
    'COMMERCE_PENDING',    // comisiones capturadas, pendientes de liquidación al comercio
    'COMMERCE_AVAILABLE',  // disponibles para retiro o reinversión
  ] },
  delta:                   { type: Number, required: true },
  event_type:              { type: String, required: true },
  created_at:              { type: Date, default: Date.now },
}, { timestamps: false });

ledgerSchema.index({ transaction_id: 1, account: 1 });

const Ledger = mongoose.models.Ledger || mongoose.model('Ledger', ledgerSchema, 'ledger');

async function postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account, delta, event_type }, session) {
  const [entry] = await Ledger.create([{
    transaction_id,
    provider_transaction_id,
    order_id,
    account,
    delta,
    event_type,
  }], { session });
  return entry;
}

module.exports = { Ledger, postLedgerEntry };
