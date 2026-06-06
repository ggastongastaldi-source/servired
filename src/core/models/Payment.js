const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  correlationId:       { type: String, required: true, index: true },
  quoteId:             { type: String },
  orderId:             { type: String },
  customerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  workerId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  provider:            { type: String, default: 'mercadopago' },
  preferenceId:        { type: String },
  paymentId:           { type: String, index: true },
  externalReference:   { type: String, index: true },
  amount:              { type: Number, required: true },
  platformFee:         { type: Number },
  workerPayoutAmount:  { type: Number },
  currency:            { type: String, default: 'ARS' },
  status:              { type: String, enum: ['PENDING','APPROVED','REJECTED'], default: 'PENDING' },
  paymentMethod:       { type: String },
  installments:        { type: Number },
  approvedAt:          { type: Date },
  rejectedAt:          { type: Date },
  rawWebhook:          { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

PaymentSchema.index({ provider: 1, paymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
