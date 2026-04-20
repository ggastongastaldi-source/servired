const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema({
  correlationId: { type: String, required: true, index: true },
  command: { type: String, required: true },
  user: { type: String, required: true },
  payload: Object,
  context_before: Object,
  context_after: Object,
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
  error: String,
  timestamp: { type: Date, default: Date.now }
});

const Audit = mongoose.model('Audit', AuditSchema);

module.exports = {
  logStart: async (data) => await Audit.create(data),
  logEnd: async (id, result) => await Audit.findByIdAndUpdate(id, { ...result, status: 'SUCCESS' }),
  logFail: async (id, error) => await Audit.findByIdAndUpdate(id, { error, status: 'FAILED' })
};
