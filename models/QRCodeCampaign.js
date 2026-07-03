const mongoose = require('mongoose');

const QRCodeCampaignSchema = new mongoose.Schema({
  ref: { type: String, required: true, index: true },
  campaign: { type: String, required: true },
  region: { type: String, default: 'AMBA' },
  scope: { type: String, default: 'onboarding_commerce' },
  channel: { type: String, default: 'offline_qr' },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  scansCount: { type: Number, default: 0 },
  conversionsCount: { type: Number, default: 0 },
  commissionRule: { type: String, default: 'signup_base_commission' },
  revokedQrIds: [{ type: String }], // permite anular un QR físico puntual sin tocar la campaña completa
}, { timestamps: true });

QRCodeCampaignSchema.index({ ref: 1, campaign: 1 }, { unique: true });

module.exports = mongoose.model('QRCodeCampaign', QRCodeCampaignSchema);
