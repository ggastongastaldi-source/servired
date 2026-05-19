const mongoose = require('mongoose');
const crypto   = require('crypto');
const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');
const workerSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true, index: true },
  auth: {
    reconnectTokenHash:      { type: String, select: false },
    reconnectTokenExpiresAt: { type: Date },
    reconnectTokenVersion:   { type: Number, default: 0 },
    reconnectTokenIssuedAt:  { type: Date },
    lastRestoreAt:           { type: Date },
    lastRestoreIp:           { type: String },
    lastRestoreUserAgent:    { type: String },
    lastRestoreNetworkType:  { type: String },
  },
  connection: {
    socketId:       { type: String, default: null },
    connectedAt:    { type: Date,   default: null },
    sessionVersion: { type: Number, default: 0 },
  },
  presence: {
    online:        { type: Boolean, default: false, index: true },
    lastHeartbeat: { type: Date,    default: null,  index: true },
    lastSeen:      { type: Date,    default: null },
  },
  dispatch: {
    availability: { type: String, enum: ['DISPONIBLE','OCUPADO','PAUSA'], default: 'DISPONIBLE', index: true },
    zona:         { type: String,   index: true },
    rubros:       { type: [String], index: true },
    currentJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  },
  location:  { lat: { type: Number }, lng: { type: Number }, updatedAt: { type: Date } },
  runtime: {
    appVersion:   { type: String },
    platform:     { type: String },
    batteryLevel: { type: Number },
    networkType:  { type: String },
    gpsAccuracy:  { type: Number },
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

workerSchema.index({ 'presence.online': 1, 'dispatch.availability': 1, 'dispatch.zona': 1, 'dispatch.rubros': 1 });

workerSchema.virtual('fsmState').get(function () {
  if (!this.presence.online)                       return 'DESCONECTADO';
  if (this.dispatch.currentJobId)                  return 'OCUPADO';
  if (this.dispatch.availability === 'PAUSA')      return 'PAUSA';
  if (this.dispatch.availability === 'DISPONIBLE') return 'DISPONIBLE';
  return 'CONECTADO';
});

workerSchema.virtual('reliabilityFlags').get(function () {
  const flags = [];
  if (this.runtime.batteryLevel != null && this.runtime.batteryLevel < 15) flags.push('LOW_BATTERY');
  if (this.runtime.networkType === '2g') flags.push('SLOW_NETWORK');
  if (this.runtime.gpsAccuracy  != null && this.runtime.gpsAccuracy  > 150) flags.push('POOR_GPS');
  return flags;
});

workerSchema.statics.issueReconnectToken = async function (workerId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash     = sha256(rawToken);
  const now      = new Date();
  await this.findOneAndUpdate({ workerId }, {
    $set: { 'auth.reconnectTokenHash': hash, 'auth.reconnectTokenIssuedAt': now, 'auth.reconnectTokenExpiresAt': new Date(now.getTime() + 8*60*60*1000) },
    $inc: { 'auth.reconnectTokenVersion': 1 },
  });
  return rawToken;
};

workerSchema.statics.verifyReconnectToken = async function (workerId, rawToken) {
  const hash   = sha256(rawToken);
  const worker = await this.findOne({ workerId, 'auth.reconnectTokenHash': hash }, '+auth.reconnectTokenHash +auth.reconnectTokenExpiresAt');
  if (!worker) return null;
  if (worker.auth.reconnectTokenExpiresAt < new Date()) return null;
  return worker;
};

module.exports = mongoose.model('Worker', workerSchema);
