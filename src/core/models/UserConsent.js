'use strict';
const mongoose = require('mongoose');

const userConsentSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  documentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'LegalDocument', required: true },
  documentType:    { type: String, required: true, index: true },
  version:         { type: String, required: true },
  contentHash:     { type: String, required: true },
  acceptedAt:      { type: Date, required: true, default: () => new Date() },
  ip:              { type: String, default: null },
  userAgent:       { type: String, default: null },
  sinapsisEventId: { type: String, default: null, index: true },
  context: {
    type: String,
    enum: ['registration','login','policy_update','feature_gate','manual'],
    default: 'registration',
  },
}, { timestamps: true, collection: 'user_consents' });

userConsentSchema.index({ userId: 1, documentType: 1, acceptedAt: -1 });
userConsentSchema.index({ userId: 1, documentId: 1 }, { unique: true });
['findOneAndUpdate','updateOne','updateMany'].forEach(h =>
  userConsentSchema.pre(h, function() { throw new Error('UserConsent es insert-only.'); })
);

const UserConsent = mongoose.model('UserConsent', userConsentSchema);

async function checkUserCompliance(userId, role) {
  const { getRequiredDocuments } = require('./LegalDocument');
  const required = await getRequiredDocuments(role);
  if (!required.length) return { ok: true, pending: [] };
  const accepted = await UserConsent.find({
    userId, documentId: { $in: required.map(d => d._id) },
  }).lean();
  const acceptedIds = new Set(accepted.map(c => c.documentId.toString()));
  const pending = required.filter(d => !acceptedIds.has(d._id.toString()));
  return { ok: pending.length === 0, pending };
}

module.exports = { UserConsent, checkUserCompliance };
