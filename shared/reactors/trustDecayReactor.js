'use strict';

/**
 * TRUST DECAY REACTOR — Gobernanza de confianza basada en eventos
 *
 * Patrón: mismo que PriceAnomalyObserver (micro-batch, memoria ephemeral)
 * Invariante: replay-safe — trust arranca en 1.0 cada ejecución
 *
 * Inputs (vía subscribe):
 *   AnomalyDetected  → degrada trust del actor
 *   PRICE_SUBMITTED  → acumula actividad limpia (recovery window)
 *
 * Outputs (vía router.publish):
 *   ActorTrustUpdated      → informativo, siempre
 *   ActorInfluenceReduced  → cuando trust < INFLUENCE_THRESHOLD
 */

const { createEvent } = require('../events/createEvent');

// ── Parámetros de la state machine ──────────────────────────
const TRUST_INITIAL        = 1.0;
const K1_DECAY             = 0.15;   // penalización por anomalía: trust -= deviationIndex * K1
const RECOVERY_RATE        = 0.05;   // recuperación por actividad limpia por ventana
const DECAY_LAMBDA         = 0.02;   // decaimiento temporal pasivo: trust *= exp(-λ * dt_minutes)
const INFLUENCE_THRESHOLD  = 0.45;   // por debajo → emitir ActorInfluenceReduced
const QUARANTINE_THRESHOLD = 0.15;   // por debajo → influencia mínima (hysteresis hard floor)
const CLEAN_WINDOW_SIZE    = 5;      // N eventos limpios consecutivos → aplicar recovery

const BATCH_INTERVAL_MS    = 2000;

// ── Estado ephemeral (en memoria) ───────────────────────────
// actorId → { trust, lastUpdated, cleanStreak, zone }
const _trustState = new Map();

let _router  = null;
let _buffer  = [];
let _timer   = null;
let _active  = false;

// ── Pure reducer (testeable sin efectos) ────────────────────

function _getState(actorId) {
  if (!_trustState.has(actorId)) {
    _trustState.set(actorId, {
      trust:       TRUST_INITIAL,
      lastUpdated: Date.now(),
      cleanStreak: 0,
      zone:        null,
    });
  }
  return _trustState.get(actorId);
}

function _applyDecay(state) {
  const now      = Date.now();
  const dtMin    = (now - state.lastUpdated) / 60000;
  state.trust   *= Math.exp(-DECAY_LAMBDA * dtMin);
  state.trust    = Math.max(QUARANTINE_THRESHOLD, state.trust);
  state.lastUpdated = now;
}

function _applyAnomaly(state, deviationIndex) {
  _applyDecay(state);
  state.trust    -= deviationIndex * K1_DECAY;
  state.trust     = Math.max(QUARANTINE_THRESHOLD, state.trust);
  state.cleanStreak = 0;
}

function _applyCleanActivity(state) {
  _applyDecay(state);
  state.cleanStreak++;
  if (state.cleanStreak >= CLEAN_WINDOW_SIZE) {
    state.trust      = Math.min(TRUST_INITIAL, state.trust + RECOVERY_RATE);
    state.cleanStreak = 0;
  }
}

// ── API pública ──────────────────────────────────────────────

function getTrust(actorId) {
  const s = _trustState.get(actorId);
  return s ? s.trust : TRUST_INITIAL;
}

function getAllTrust() {
  const result = {};
  for (const [id, s] of _trustState) result[id] = s.trust;
  return result;
}

function init(router) {
  if (_active) return;
  _router = router;
  _active = true;

  router.subscribe('AnomalyDetected',  _onAnomalyDetected);
  router.subscribe('PRICE_SUBMITTED',  _onPriceSubmitted);

  _timer = setInterval(_processBatch, BATCH_INTERVAL_MS);
  if (_timer.unref) _timer.unref();

  console.log('[TrustDecayReactor] Activo.');
}

function _onAnomalyDetected(persisted) {
  if (!persisted) return;
  _buffer.push({ type: 'anomaly', persisted, receivedAt: Date.now() });
}

function _onPriceSubmitted(persisted) {
  if (!persisted) return;
  _buffer.push({ type: 'clean', persisted, receivedAt: Date.now() });
}

async function _processBatch() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0, _buffer.length);

  // Separar anomalías de actividad limpia por actor
  const anomalies = batch.filter(b => b.type === 'anomaly');
  const cleans    = batch.filter(b => b.type === 'clean');

  // Actores con anomalía en este batch — no cuentan como limpios
  const dirtyActors = new Set(
    anomalies.map(b => b.persisted.event.payload && b.persisted.event.payload.actorId).filter(Boolean)
  );

  // Procesar anomalías
  for (const { persisted } of anomalies) {
    const p         = persisted.event.payload || {};
    const actorId   = p.actorId;
    const deviation = p.deviationIndex || 0;
    const zone      = (persisted.event.context && persisted.event.context.zone) || 'unknown';
    if (!actorId) continue;

    const state  = _getState(actorId);
    const before = state.trust;
    state.zone   = zone;
    _applyAnomaly(state, deviation);

    await _emitTrustUpdated({ actorId, zone, before, after: state.trust, reason: 'anomaly', deviation, correlationId: persisted.event.correlation_id });

    if (state.trust < INFLUENCE_THRESHOLD) {
      await _emitInfluenceReduced({ actorId, zone, trust: state.trust, correlationId: persisted.event.correlation_id });
    }
  }

  // Procesar actividad limpia (solo actores sin anomalía en este batch)
  for (const { persisted } of cleans) {
    const actorId = persisted.event.actor && persisted.event.actor.user_id;
    if (!actorId || dirtyActors.has(actorId)) continue;

    const state  = _getState(actorId);
    const before = state.trust;
    _applyCleanActivity(state);

    // Solo emitir si hubo cambio real (recovery aplicada)
    if (state.trust !== before) {
      await _emitTrustUpdated({ actorId, zone: state.zone || 'unknown', before, after: state.trust, reason: 'recovery', deviation: 0, correlationId: persisted.event.correlation_id });
    }
  }
}

async function _emitTrustUpdated({ actorId, zone, before, after, reason, deviation, correlationId }) {
  try {
    const ev = createEvent({
      type:    'ActorTrustUpdated',
      actor:   { user_id: 'trustDecayReactor', role: 'reactor' },
      context: { zone, source: 'trustDecayReactor' },
      payload: { actorId, trustBefore: before, trustAfter: after, reason, deviationIndex: deviation },
      correlationId,
    });
    await _router.publish(ev);
    console.log(`[TrustDecay] ${actorId} | ${reason} | ${before.toFixed(3)} → ${after.toFixed(3)}`);
  } catch (err) {
    console.error('[TrustDecay] Error emitiendo ActorTrustUpdated:', err.message);
  }
}

async function _emitInfluenceReduced({ actorId, zone, trust, correlationId }) {
  try {
    const ev = createEvent({
      type:    'ActorInfluenceReduced',
      actor:   { user_id: 'trustDecayReactor', role: 'reactor' },
      context: { zone, source: 'trustDecayReactor' },
      payload: { actorId, trust, reason: 'trust_below_threshold', threshold: INFLUENCE_THRESHOLD },
      correlationId,
    });
    await _router.publish(ev);
    console.log(`[TrustDecay] ⚠ InfluenceReduced | ${actorId} | trust:${trust.toFixed(3)}`);
  } catch (err) {
    console.error('[TrustDecay] Error emitiendo ActorInfluenceReduced:', err.message);
  }
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _active = false;
}

module.exports = { init, stop, getTrust, getAllTrust };
