// ServiRed — Circuit Breaker State Machine v1.0
// Estados: CLOSED → DEGRADED → OPEN → HALF_OPEN → CLOSED
const mongoose = require('mongoose');

const STATES = { CLOSED:'CLOSED', DEGRADED:'DEGRADED', OPEN:'OPEN', HALF_OPEN:'HALF_OPEN' };

const circuits = new Map(); // circuitId → state

function _default(circuitId) {
  return {
    circuitId,
    state: STATES.CLOSED,
    failures: 0,
    successes: 0,
    lastFailure: null,
    cooldownUntil: null,
    thresholdDegraded: 3,  // fallas → DEGRADED
    thresholdOpen: 6,      // fallas → OPEN
    successToClose: 2,     // éxitos en HALF_OPEN → CLOSED
    cooldownMs: 30000,     // 30s antes de HALF_OPEN
    updatedAt: new Date(),
  };
}

function getCircuit(circuitId) {
  if (!circuits.has(circuitId)) circuits.set(circuitId, _default(circuitId));
  return circuits.get(circuitId);
}

function recordSuccess(circuitId) {
  const c = getCircuit(circuitId);
  c.successes++;
  c.updatedAt = new Date();

  if (c.state === STATES.HALF_OPEN && c.successes >= c.successToClose) {
    _transition(c, STATES.CLOSED);
    c.failures = 0;
    c.successes = 0;
  } else if (c.state === STATES.DEGRADED) {
    c.failures = Math.max(0, c.failures - 1);
    if (c.failures === 0) _transition(c, STATES.CLOSED);
  }
  _persist(c);
}

function recordFailure(circuitId, error = '') {
  const c = getCircuit(circuitId);
  c.failures++;
  c.successes = 0;
  c.lastFailure = new Date();
  c.updatedAt = new Date();

  if (c.state === STATES.CLOSED && c.failures >= c.thresholdDegraded) {
    _transition(c, STATES.DEGRADED);
  }
  if (c.failures >= c.thresholdOpen) {
    c.cooldownUntil = new Date(Date.now() + c.cooldownMs);
    _transition(c, STATES.OPEN);
  }
  if (c.state === STATES.HALF_OPEN) {
    c.cooldownUntil = new Date(Date.now() + c.cooldownMs);
    _transition(c, STATES.OPEN);
  }
  _persist(c);
  console.warn(`[CircuitBreaker] ⚡ ${circuitId} → ${c.state} (fallas: ${c.failures}) ${error}`);
}

function canDispatch(circuitId) {
  const c = getCircuit(circuitId);
  const now = Date.now();

  if (c.state === STATES.OPEN) {
    if (c.cooldownUntil && now >= new Date(c.cooldownUntil).getTime()) {
      _transition(c, STATES.HALF_OPEN);
      c.successes = 0;
      _persist(c);
      return true; // probe permitido
    }
    return false; // bloqueado
  }
  if (c.state === STATES.HALF_OPEN) return true; // solo probes
  return true; // CLOSED y DEGRADED permiten dispatch
}

function getState(circuitId) {
  return getCircuit(circuitId).state;
}

function getAll() {
  return [...circuits.values()];
}

function _transition(c, newState) {
  const prev = c.state;
  c.state = newState;
  console.log(`[CircuitBreaker] 🔄 ${c.circuitId}: ${prev} → ${newState}`);
  // Emitir al Nexus si está disponible
  try {
    const { emitEvent } = require('../events/emitEvent');
    emitEvent({
      entityType: 'circuit',
      type: 'CIRCUIT_STATE_CHANGED',
      aggregateId: c.circuitId,
      payload: { from: prev, to: newState, failures: c.failures, cooldownUntil: c.cooldownUntil }
    });
  } catch(e) {}
}

function _persist(c) {
  try {
    mongoose.connection.collection('circuit_states').updateOne(
      { circuitId: c.circuitId },
      { $set: { ...c, updatedAt: new Date() } },
      { upsert: true }
    ).catch(() => {});
  } catch(e) {}
}

// Wrapper ejecutor con circuit breaker integrado
async function execute(circuitId, fn, fallback = null) {
  if (!canDispatch(circuitId)) {
    console.warn(`[CircuitBreaker] 🚫 ${circuitId} OPEN — dispatch bloqueado`);
    if (typeof fallback === 'function') return fallback();
    return null;
  }
  try {
    const result = await fn();
    recordSuccess(circuitId);
    return result;
  } catch(e) {
    recordFailure(circuitId, e.message);
    if (typeof fallback === 'function') return fallback();
    throw e;
  }
}

module.exports = { execute, canDispatch, recordSuccess, recordFailure, getState, getAll, STATES };
