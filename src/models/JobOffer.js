const mongoose = require('mongoose');

const JobOfferSchema = new mongoose.Schema({
  pedidoId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', required: true, index: true },
  status:     { type: String, enum: ['OPEN','ACCEPTED','EXPIRED','CANCELLED_BY_FALLBACK'], default: 'OPEN' },
  acceptedBy: { type: String, default: null },
  expiresAt:  { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.models.JobOffer || mongoose.model('JobOffer', JobOfferSchema, 'job_offers');
