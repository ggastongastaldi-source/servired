// idempotency.js — store de idempotencia con MongoDB (swap a Redis: misma interfaz)
const mongoose = require('mongoose');

const idemSchema = new mongoose.Schema({
  key:       { type: String, unique: true },
  status:    { type: String, enum: ['PENDING','PROCESSING','DONE'], default: 'PENDING' },
  result:    Object,
  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

const Idem = mongoose.models.SepIdem || mongoose.model('SepIdem', idemSchema);

// returns { acquired: bool, existing?: doc }
async function acquire(key) {
  try {
    await Idem.create({ key, status: 'PENDING' });
    return { acquired: true };
  } catch (e) {
    if (e.code === 11000) {
      const existing = await Idem.findOne({ key }).lean();
      return { acquired: false, existing };
    }
    throw e;
  }
}

async function markProcessing(key) {
  await Idem.updateOne({ key }, { $set: { status: 'PROCESSING' } });
}

async function markDone(key, result) {
  await Idem.updateOne({ key }, { $set: { status: 'DONE', result } });
}

async function get(key) {
  return Idem.findOne({ key }).lean();
}

module.exports = { acquire, markProcessing, markDone, get };
