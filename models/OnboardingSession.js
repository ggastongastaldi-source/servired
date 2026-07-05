const mongoose = require('mongoose');

const OnboardingSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  ref: { type: String, required: true },
  campaign: { type: String, required: true },
  qrId: { type: String },
  status: {
    type: String,
    enum: ['pending', 'validated', 'authenticated', 'profile_created', 'completed', 'expired', 'aborted'],
    default: 'pending',
  },
  deviceFingerprint: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  commerceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile', default: null },
  completedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('OnboardingSession', OnboardingSessionSchema);
