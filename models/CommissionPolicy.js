const mongoose = require('mongoose');

const TierSchema = new mongoose.Schema({
  maxAmount: { type: Number, default: null },
  rate:      { type: Number, required: true },
  label:     { type: String, required: true },
}, { _id: false });

const PromotionSchema = new mongoose.Schema({
  code:         { type: String, required: true },
  discountRate: { type: Number, required: true },
  validUntil:   { type: Date,   required: true },
}, { _id: false });

const CommissionPolicySchema = new mongoose.Schema({
  policyVersion:  { type: String,  required: true, unique: true },
  active:         { type: Boolean, default: false },
  tiers:          { type: [TierSchema], required: true },
  promotions:     { type: [PromotionSchema], default: [] },
  rubroOverrides: { type: Map, of: Number, default: {} },
  zoneOverrides:  { type: Map, of: Number, default: {} },
  description:    { type: String, default: '' },
  createdAt:      { type: Date, default: Date.now },
}, { collection: 'commission_policies' });

CommissionPolicySchema.pre('save', async function(next) {
  if (this.active && this.isModified('active')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { active: false } }
    );
  }
  next();
});

module.exports = mongoose.model('CommissionPolicy', CommissionPolicySchema);
