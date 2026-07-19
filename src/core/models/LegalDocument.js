'use strict';
const mongoose = require('mongoose');

const DOCUMENT_TYPES = [
  'privacy_policy','terms_of_use','merchant_agreement',
  'worker_agreement','ai_policy','cookies_policy','data_processing_policy',
];

const legalDocumentSchema = new mongoose.Schema({
  type:        { type: String, enum: DOCUMENT_TYPES, required: true, index: true },
  version:     { type: String, required: true },
  title:       { type: String, required: true },
  content:     { type: String, required: true },
  contentHash: { type: String, required: true, index: true },
  status:      { type: String, enum: ['draft','active','superseded'], default: 'draft', index: true },
  effectiveAt: { type: Date, default: null },
  supersededBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'LegalDocument', default: null },
  requiredFor: { type: [String], default: [] },
}, { timestamps: true, collection: 'legal_documents' });

legalDocumentSchema.index({ type: 1, version: 1 }, { unique: true });
legalDocumentSchema.index({ type: 1, status: 1 });
['findOneAndUpdate','updateOne','updateMany'].forEach(h =>
  legalDocumentSchema.pre(h, function() { throw new Error('LegalDocument es insert-only.'); })
);

const LegalDocument = mongoose.model('LegalDocument', legalDocumentSchema);

async function getActiveDocument(type) {
  return LegalDocument.findOne({ type, status: 'active' }).lean();
}
async function getRequiredDocuments(role) {
  return LegalDocument.find({ status: 'active', requiredFor: role }).lean();
}

module.exports = { LegalDocument, getActiveDocument, getRequiredDocuments, DOCUMENT_TYPES };
