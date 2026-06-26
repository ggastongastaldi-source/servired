/**
 * Ontology Drift Engine (ODE) — ServiRed OS
 * Persistence contract v1: acceso único via lazy getters
 * NO modifica el catálogo. Solo genera señales de propuesta.
 */

const mongoose = require('mongoose');

// ── Schemas ────────────────────────────────────────────────────
const ObservationSchema = new mongoose.Schema({
  inputTerm:     { type: String, required: true },
  normalizedTerm:{ type: String, required: true },
  source:        { type: String, required: true },
  zoneId:        { type: String, default: 'UNKNOWN_ZONE' },
  actorId:       { type: String, default: null },
  observedAt:    { type: Date,   default: Date.now }
}, { collection: 'ode_observations' });

ObservationSchema.index({ normalizedTerm: 1, observedAt: -1 });
ObservationSchema.index({ observedAt: -1 });

const DriftSignalSchema = new mongoose.Schema({
  normalizedTerm:   { type: String, required: true, unique: true },
  inputTerms:       [String],
  frequency24h:     { type: Number, default: 0 },
  frequency7d:      { type: Number, default: 0 },
  zoneDistribution: { type: Map, of: Number, default: {} },
  sources:          [String],
  driftScore:       { type: Number, default: 0 },
  status:           { type: String, enum: ['OBSERVED','PROPOSED','APPROVED','REJECTED'], default: 'OBSERVED' },
  firstSeenAt:      { type: Date, default: Date.now },
  lastSeenAt:       { type: Date, default: Date.now },
  updatedAt:        { type: Date, default: Date.now }
}, { collection: 'ode_drift_signals' });

DriftSignalSchema.index({ driftScore: -1 });
DriftSignalSchema.index({ status: 1, driftScore: -1 });

// ── Lazy model getters — único punto de acceso ─────────────────
function Obs() {
  return mongoose.models.OdeObservation
    || mongoose.model('OdeObservation', ObservationSchema);
}

function Sig() {
  return mongoose.models.OdeDriftSignal
    || mongoose.model('OdeDriftSignal', DriftSignalSchema);
}

// ── Normalización ──────────────────────────────────────────────
function _norm(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ── API pública ────────────────────────────────────────────────
async function recordObservation(inputTerm, source, opts = {}) {
  if (!inputTerm || typeof inputTerm !== 'string') return;
  if (mongoose.connection.readyState !== 1) {
    console.warn('[ODE] Skip — DB no conectada (readyState:', mongoose.connection.readyState, ')');
    return;
  }
  try {
    await Obs().create({
      inputTerm,
      normalizedTerm: _norm(inputTerm),
      source,
      zoneId:  opts.zoneId  || 'UNKNOWN_ZONE',
      actorId: opts.actorId || null
    });
    console.log('[ODE] ✅ Observacion persistida:', inputTerm, '→', _norm(inputTerm));
  } catch (err) {
    if (err.code !== 11000) {
      console.error('[ODE] ❌ Error persistiendo:', inputTerm, '|', err.message);
    }
  }
}

async function aggregate() {
  const now   = new Date();
  const ago24h = new Date(now - 24 * 60 * 60 * 1000);
  const ago7d  = new Date(now - 7  * 24 * 60 * 60 * 1000);

  const groups = await Obs().aggregate([
    { $match: { observedAt: { $gte: ago7d } } },
    { $group: {
      _id:         '$normalizedTerm',
      inputTerms:  { $addToSet: '$inputTerm' },
      frequency7d: { $sum: 1 },
      sources:     { $addToSet: '$source' },
      zones:       { $push: '$zoneId' },
      lastSeenAt:  { $max: '$observedAt' },
      firstSeenAt: { $min: '$observedAt' }
    }},
    { $sort: { frequency7d: -1 } }
  ]);

  const freq24hMap = {};
  const obs24h = await Obs().aggregate([
    { $match: { observedAt: { $gte: ago24h } } },
    { $group: { _id: '$normalizedTerm', count: { $sum: 1 } } }
  ]);
  for (const r of obs24h) freq24hMap[r._id] = r.count;

  let proposed = 0;
  for (const g of groups) {
    const f24 = freq24hMap[g._id] || 0;
    const f7d = g.frequency7d;
    const driftScore = Math.min(100, f7d * 10 + f24 * 20);
    const zoneDist = {};
    for (const z of g.zones) zoneDist[z] = (zoneDist[z] || 0) + 1;
    const status = driftScore >= 40 ? 'PROPOSED' : 'OBSERVED';
    if (status === 'PROPOSED') proposed++;

    await Sig().findOneAndUpdate(
      { normalizedTerm: g._id },
      { $set: { inputTerms: g.inputTerms, frequency24h: f24, frequency7d: f7d,
                zoneDistribution: zoneDist, sources: g.sources, driftScore,
                status, lastSeenAt: g.lastSeenAt, updatedAt: now },
        $setOnInsert: { firstSeenAt: g.firstSeenAt } },
      { upsert: true }
    );
  }

  console.log(`[ODE] Agregacion completa — ${groups.length} terminos, ${proposed} PROPOSED`);
  return { analyzed: groups.length, proposed };
}

async function getProposals(limit = 20) {
  return Sig().find({ status: 'PROPOSED' }).sort({ driftScore: -1 }).limit(limit).lean();
}

async function getAll(limit = 50) {
  return Sig().find({}).sort({ driftScore: -1 }).limit(limit).lean();
}

module.exports = { recordObservation, aggregate, getProposals, getAll };
