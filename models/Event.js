const mongoose = require('mongoose');
const crypto = require('crypto');
const {
  CONSTITUTION_VERSION,
  SCHEMA_VERSION,
  ACTOR_TYPES,
  EVENT_TYPES,
  getEventClass,
  DEMAND_SOURCES
} = require('../constants/eventTaxonomy');

const EventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },
  eventType: { type: String, required: true, enum: EVENT_TYPES },

  // DERIVADO — ver pre('validate') hook. Cualquier valor manual es ignorado y recalculado.
  eventClass: { type: String, required: true, enum: ['Operational', 'Economic'] },

  actorType: { type: String, required: true, enum: Object.values(ACTOR_TYPES) },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  zoneId: { type: String, index: true },
  correlationId: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },

  source: { type: String, enum: DEMAND_SOURCES },
  verificationStatus: {
    type: String,
    enum: ['RawDemand', 'VerifiedDemand', 'Rejected'],
    default: 'RawDemand'
  },

  schemaVersion: { type: Number, default: SCHEMA_VERSION },
  constitutionVersion: { type: String, default: CONSTITUTION_VERSION }
}, { timestamps: true });

// Constitucional: eventClass jamás se confía a quien escribe el evento.
EventSchema.pre('validate', function (next) {
  this.eventClass = getEventClass(this.eventType);
  next();
});

EventSchema.index({ eventType: 1, zoneId: 1, createdAt: -1 });
EventSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });
EventSchema.index({ verificationStatus: 1, zoneId: 1 });

module.exports = mongoose.model('Event', EventSchema);
