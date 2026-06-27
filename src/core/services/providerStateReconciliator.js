'use strict';
const mongoose = require('mongoose');

// ── Colección fuente de verdad (SINAPSIS bus log) ────────────────
const SinapsisBusLog = mongoose.models.SinapsisBusLog ||
  mongoose.model('SinapsisBusLog',
    new mongoose.Schema({}, { strict: false, collection: 'sinapsis_bus_log' })
  );

// ── Colección de drift events ────────────────────────────────────
const DriftSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  drift:     [String],
  expected:  mongoose.Schema.Types.Mixed,
  actual:    mongoose.Schema.Types.Mixed,
  severity:  { type: String, enum: ['MINOR','CRITICAL'], default: 'MINOR' },
  createdAt: { type: Date, default: Date.now, index: true },
  resolved:  { type: Boolean, default: false }
}, { collection: 'state_drift_events' });
DriftSchema.index({ severity: 1 });
const StateDrift = mongoose.models.StateDrift ||
  mongoose.model('StateDrift', DriftSchema);

// ── Eventos relevantes ───────────────────────────────────────────
const PROVIDER_TYPES = [
  'PROVIDER_ONBOARDING_STARTED',
  'PROVIDER_PROFILE_COMPLETED',
  'PROVIDER_ACTIVATED',
  'PROVIDER_ONBOARDING_ABANDONED'
];

// ── 1. Cargar eventos desde SINAPSIS ────────────────────────────
async function loadEvents(userId) {
  return SinapsisBusLog.find({
    eventType: { $in: PROVIDER_TYPES },
    'payload.userId': String(userId)
  }).sort({ sequence: 1 }).lean();
}

// ── 2. Replay puro (reducer sin efectos secundarios) ─────────────
function replayProvider(events) {
  const state = { providerState: 'NONE', onboardingStep: null };
  for (const e of events) {
    switch (e.eventType) {
      case 'PROVIDER_ONBOARDING_STARTED':
        state.providerState = 'ONBOARDING';
        state.onboardingStep = 'category';
        break;
      case 'PROVIDER_PROFILE_COMPLETED':
        state.onboardingStep = 'completed';
        break;
      case 'PROVIDER_ACTIVATED':
        state.providerState = 'ACTIVE_PROVIDER';
        state.onboardingStep = null;
        break;
      case 'PROVIDER_ONBOARDING_ABANDONED':
        state.providerState = 'NONE';
        state.onboardingStep = null;
        break;
    }
  }
  return state;
}

// ── 3. Diff determinístico ───────────────────────────────────────
function diffState(expected, actual) {
  const drift = [];
  if (expected.providerState !== actual.providerState)
    drift.push('providerState_mismatch');
  if (expected.onboardingStep !== actual.onboardingStep)
    drift.push('onboardingStep_mismatch');
  return drift;
}

// ── 4. Reconciliar un usuario ────────────────────────────────────
async function reconcileUser(userId) {
  const Usuario = require('../models/Usuario');
  const u = await Usuario.findById(userId).lean();
  if (!u) return { ok: false, error: 'usuario_not_found' };

  const events = await loadEvents(userId);
  const expected = replayProvider(events);
  const actual = {
    providerState: u.providerState || 'NONE',
    onboardingStep: u.onboardingStep || null
  };
  const drift = diffState(expected, actual);

  if (drift.length === 0) return { ok: true, userId, drift: [], status: 'CONSISTENT' };

  const severity = drift.includes('providerState_mismatch') ? 'CRITICAL' : 'MINOR';
  await StateDrift.create({ userId: String(userId), drift, expected, actual, severity });

  return { ok: true, userId, drift, expected, actual, severity, status: 'DRIFT_DETECTED' };
}

// ── 5. Batch runner ──────────────────────────────────────────────
async function reconcileAllProviders() {
  const Usuario = require('../models/Usuario');
  const users = await Usuario.find({
    providerState: { $in: ['ONBOARDING','ACTIVE_PROVIDER'] }
  }).select('_id').lean();

  const results = { total: users.length, consistent: 0, drift: 0, errors: 0 };
  for (const u of users) {
    try {
      const r = await reconcileUser(u._id);
      if (r.status === 'CONSISTENT') results.consistent++;
      else results.drift++;
    } catch(e) {
      results.errors++;
      console.error('[Reconciliator] error usuario', u._id, e.message);
    }
  }
  console.log('[Reconciliator] batch completo:', JSON.stringify(results));
  return results;
}

module.exports = { loadEvents, replayProvider, diffState, reconcileUser, reconcileAllProviders };
