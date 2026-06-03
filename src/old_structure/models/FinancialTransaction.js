const mongoose = require('mongoose');

const ftSchema = new mongoose.Schema({
  transaction_id:          { type: String, required: true, unique: true },
  provider:                { type: String, required: true },
  provider_transaction_id: { type: String, required: true },
  order_id:                { type: String, required: true },
  amount:                  { type: Number, required: true },
  currency:                { type: String, default: 'ARS' },
  status:                  { type: String, enum: ['CAPTURED','RELEASED','REFUNDED'], default: 'CAPTURED' },
  platformFee:             Number,
  workerPayout:            Number,
  created_at:              { type: Date, default: Date.now },
  updated_at:              { type: Date, default: Date.now },
});

ftSchema.index({ provider: 1, provider_transaction_id: 1 }, { unique: true });

module.exports = mongoose.models.FinancialTransaction ||
  mongoose.model('FinancialTransaction', ftSchema, 'financial_transactions');
