'use strict';
const mongoose = require('mongoose');

const CommerceSchema = new mongoose.Schema({
  nombre:       { type: String, required: true, trim: true },
  email:        { type: String, required: true, trim: true, lowercase: true },
  telefono:     { type: String, trim: true },
  rubro:        { type: String, required: true, trim: true },
  direccion:    { type: String, required: true, trim: true },
  localidad:    { type: String, required: true, trim: true },
  zona:         { type: String, default: 'GBA' },
  origin_qr_id: { type: String, default: null },
  qr_code:      { type: String, default: null },
  active:       { type: Boolean, default: true },
  verificado:   { type: Boolean, default: false },
  is_boosted: { type: Boolean, default: false },
  boost_expires_at: { type: Date, default: null },
  boost_payment_id: { type: String, default: null },
}, { timestamps: true, collection: 'commerces' });

CommerceSchema.index({ localidad: 1, rubro: 1 });

module.exports = mongoose.models.Commerce || mongoose.model('Commerce', CommerceSchema);
