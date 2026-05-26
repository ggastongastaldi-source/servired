// SINAPSIS LogManager v1.0
// Memoria inmutable de eventos y decisiones

const mongoose = require('mongoose');

const SinapsisLogSchema = new mongoose.Schema({
  eventId:     { type: String, required: true, unique: true },
  type:        { type: String, required: true },
  domain:      { type: String, required: true },
  decision:    { type: String, enum: ['EXECUTE','HOLD','REJECT','ESCALATE'], required: true },
  policy_id:   { type: String },
  risk_score:  { type: Number, default: 0 },
  reason:      [{ type: String }],
  payload:     { type: mongoose.Schema.Types.Mixed },
  metadata:    { type: mongoose.Schema.Types.Mixed },
  status:      { type: String, enum: ['PENDING','PROCESSED','FAILED'], default: 'PENDING' },
  latencyMs:   { type: Number },
  sealedAt:    { type: Date, default: Date.now }
}, { suppressReservedKeysWarning: true, collection: 'sinapsis_log' });

// Índices para trazabilidad
SinapsisLogSchema.index({ eventId: 1 }, { unique: true });
SinapsisLogSchema.index({ type: 1, sealedAt: -1 });
SinapsisLogSchema.index({ domain: 1, status: 1 });
SinapsisLogSchema.index({ decision: 1, sealedAt: -1 });

const SinapsisLog = mongoose.models.SinapsisLog ||
  mongoose.model('SinapsisLog', SinapsisLogSchema);

async function seal(event, policyResult) {
  try {
    const entry = await SinapsisLog.create({
      eventId:   event.eventId,
      type:      event.type,
      domain:    event.domain || 'unknown',
      decision:  policyResult.decision,
      policy_id: policyResult.policy_id,
      risk_score: policyResult.risk_score,
      reason:    policyResult.reason,
      payload:   event.payload,
      metadata:  event.metadata,
      status:    'PROCESSED',
      latencyMs: policyResult.latencyMs,
    });
    console.log(JSON.stringify({
      level: 'info', source: 'LOG_MANAGER',
      eventId: event.eventId, type: event.type,
      decision: policyResult.decision, sealed: true
    }));
    return entry;
  } catch (err) {
    if (err.code === 11000) {
      console.warn(`[LOG_MANAGER] Evento duplicado ignorado: ${event.eventId}`);
      return null;
    }
    console.error('[LOG_MANAGER] Error sellando evento:', err.message);
    throw err;
  }
}

async function query(filter = {}, limit = 50) {
  return SinapsisLog.find(filter).sort({ sealedAt: -1 }).limit(limit).lean();
}

async function getHealth() {
  const total    = await SinapsisLog.countDocuments();
  const failed   = await SinapsisLog.countDocuments({ status: 'FAILED' });
  const rejected = await SinapsisLog.countDocuments({ decision: 'REJECT' });
  const escalated = await SinapsisLog.countDocuments({ decision: 'ESCALATE' });
  return { total, failed, rejected, escalated,
           shi: total > 0 ? ((total - failed) / total * 100).toFixed(1) : 100 };
}

module.exports = { seal, query, getHealth, SinapsisLog };
