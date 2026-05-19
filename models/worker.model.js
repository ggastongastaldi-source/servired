'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

const authSchema = new mongoose.Schema({
  reconnectTokenHash:      { type: String, select: false },
  reconnectTokenExpiresAt: { type: Date,   default: null },
  reconnectTokenVersion:   { type: Number, default: 0 },
  reconnectTokenIssuedAt:  { type: Date,   default: null },
  lastRestoreAt:           { type: Date,   default: null },
  lastRestoreIp:           { type: String, default: null },
  lastRestoreUserAgent:    { type: String, default: null },
  lastRestoreNetworkType:  { type: String, default: null },
}, { _id: false });

const connectionSchema = new mongoose.Schema({
  socketId:       { type: String, default: null },
  connectedAt:    { type: Date,   default: null },
  sessionVersion: { type: Number, default: 0 },
  reconnecting:   { type: Boolean, default: false },
}, { _id: false });

const presenceSchema = new mongoose.Schema({
  online:        { type: Boolean, default: false, index: true },
  lastHeartbeat: { type: Date,    default: null,  index: true },
  lastSeen:      { type: Date,    default: null },
}, { _id: false });

const dispatchSchema = new mongoose.Schema({
  availability: { type: String, enum: ['DISPONIBLE','OCUPADO','PAUSA'], default: 'DISPONIBLE', index: true },
  zona:         { type: String,   index: true },
  rubros:       { type: [String], index: true },
  currentJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  lat:       { type: Number },
  lng:       { type: Number },
  updatedAt: { type: Date }
}, { _id: false });

const runtimeSchema = new mongoose.Schema({
  appVersion:   { type: String },
  platform:     { type: String },
  batteryLevel: { type: Number },
  networkType:  { type: String },
  gpsAccuracy:  { type: Number },
  latencyMs:    { type: Number },
}, { _id: false });

const workerSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true, index: true },
  auth:       authSchema,
  connection: connectionSchema,
  presence:   presenceSchema,
  dispatch:   dispatchSchema,
  location:   locationSchema,
  runtime:    runtimeSchema,
}, {
  timestamps:  true,
  toJSON:      { virtuals: true },
  toObject:    { virtuals: true },
});

// Índices Compuestos y Sparses
workerSchema.index({
  'presence.online':        1,
  'dispatch.availability':  1,
  'dispatch.zona':          1,
  'dispatch.rubros':        1,
});

workerSchema.index(
  { 'auth.reconnectTokenHash': 1 },
  { sparse: true, name: 'idx_reconnect_token_hash' }
);

workerSchema.index(
  { 'auth.reconnectTokenExpiresAt': 1 },
  { sparse: true, expireAfterSeconds: 0, name: 'idx_token_ttl' }
);

// FSM State Virtual Machine (6 Estados con RECONECTANDO)
workerSchema.virtual('fsmState').get(function () {
  if (!this.presence.online) {
    if (this.connection?.reconnecting) return 'RECONECTANDO';
    return 'DESCONECTADO';
  }
  if (this.dispatch.currentJobId)                  return 'OCUPADO';
  if (this.dispatch.availability === 'PAUSA')      return 'PAUSA';
  if (this.dispatch.availability === 'DISPONIBLE') return 'DISPONIBLE';
  return 'CONECTADO';
});

// Reliability Flags dinámicos
workerSchema.virtual('reliabilityFlags').get(function () {
  const flags = [];
  const { batteryLevel, networkType, gpsAccuracy, latencyMs } = this.runtime || {};
  if (batteryLevel != null) {
    if (batteryLevel < 5)  flags.push('CRITICAL_BATTERY');
    else if (batteryLevel < 15) flags.push('LOW_BATTERY');
  }
  if (networkType === '2g') flags.push('SLOW_NETWORK');
  if (!networkType || networkType === 'unknown') flags.push('UNKNOWN_NETWORK');
  if (gpsAccuracy != null && gpsAccuracy > 150) flags.push('POOR_GPS');
  if (latencyMs != null && latencyMs > 800) flags.push('HIGH_LATENCY');
  return flags;
});

workerSchema.statics.issueReconnectToken = async function (workerId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash     = sha256(rawToken);
  const now      = new Date();
  const expires  = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const updated = await this.findOneAndUpdate(
    { workerId },
    {
      $set: {
        'auth.reconnectTokenHash':      hash,
        'auth.reconnectTokenIssuedAt':  now,
        'auth.reconnectTokenExpiresAt': expires,
      },
      $inc: { 'auth.reconnectTokenVersion': 1 },
    },
    { new: true, select: 'auth.reconnectTokenVersion' }
  );
  if (!updated) throw new Error("issueReconnectToken: workerId=" + workerId + " no encontrado");
  return { rawToken, version: updated.auth.reconnectTokenVersion };
};

workerSchema.statics.verifyReconnectToken = async function (workerId, rawToken, expectedVersion = null) {
  const hash = sha256(rawToken);
  const worker = await this.findOne(
    { workerId, 'auth.reconnectTokenHash': hash },
    '+auth.reconnectTokenHash +auth.reconnectTokenExpiresAt +auth.reconnectTokenVersion'
  );
  if (!worker) return null;
  if (worker.auth.reconnectTokenExpiresAt < new Date()) return null;
  if (expectedVersion !== null && worker.auth.reconnectTokenVersion !== expectedVersion) return null;
  return worker;
};

module.exports = mongoose.model('Worker', workerSchema);
