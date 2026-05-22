// EventStore — lead_events
// Append-only. Historia permanente del pipeline de captación.
const mongoose = require('mongoose');

const LeadEventSchema = new mongoose.Schema({
  eventId:      { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  eventVersion: { type: Number, default: 1 },
  type: {
    type: String,
    required: true,
    enum: ['LEAD_DETECTED','LEAD_QUEUED','LEAD_CONTACT_PREPARED','LEAD_CONTACTED','LEAD_RESPONDED','LEAD_REGISTERED','LEAD_VERIFIED','LEAD_ACTIVATED','LEAD_DISCARDED']
  },

  aggregateType: { type: String, default: 'lead' },
  aggregateId:   { type: mongoose.Schema.Types.ObjectId, required: true },

  actorId:   { type: mongoose.Schema.Types.ObjectId },
  actorType: { type: String, enum: ['admin','sistema','trabajador'] },

  correlationId: { type: String },
  timestamp:     { type: Date, default: Date.now, index: true },

  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, {
  collection: 'lead_events',
  strict: false
});

LeadEventSchema.index({ aggregateId: 1, timestamp: 1 });
LeadEventSchema.index({ type: 1, timestamp: -1 });
LeadEventSchema.index({ 'payload.zona': 1 });
LeadEventSchema.index({ 'payload.rubro': 1 });

module.exports = mongoose.models.LeadEvent || mongoose.model('LeadEvent', LeadEventSchema);
