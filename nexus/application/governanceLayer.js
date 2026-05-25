// ServiRed — Governance Layer v1.0
// Principio 10 del prompt maestro: GOVERNANCE FIRST
// PolicyShiftEvent tiene autoridad para degradar, throttlear, activar fallback

const { emitEvent } = require('../events/emitEvent');
const { STATES, recordFailure, recordSuccess, getState } = require('../infrastructure/circuitBreaker');

// ── POLÍTICAS ACTIVAS ────────────────────────────────────────
const policies = {
  maxPedidosPorMinuto: 60,
  maxWorkersOfflineMs: 10 * 60 * 1000, // 10 min
  alertaOutboxPendientes: 50,
  alertaDeadLetters: 5,
  modoEmergencia: false,
  throttleActivo: false,
  fallbackActivo: false,
  policyVersion: '1.0',
  updatedAt: new Date(),
};

// ── OPERATIONAL PULSE ────────────────────────────────────────
// Chequea salud del sistema cada 60 segundos

let _pulseInterval = null;

async function startPulse(io) {
  if (_pulseInterval) return;

  _pulseInterval = setInterval(async () => {
    await _checkHealth(io);
  }, 60000);

  // Primer chequeo a los 15 segundos
  setTimeout(() => _checkHealth(io).catch(() => {}), 15000);
  console.log('[Governance] 💓 Operational Pulse iniciado — intervalo 60s');
}

async function _checkHealth(io) {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    if (!db) return;

    const issues = [];

    // Chequear outbox — mensajes pendientes acumulados
    const outboxPending = await db.collection('outbox')
      .countDocuments({ status: { $in: ['PENDING', 'FAILED'] } });

    if (outboxPending > policies.alertaOutboxPendientes) {
      issues.push(`Outbox acumulado: ${outboxPending} pendientes`);
      _emitPolicyShift('OUTBOX_SATURADO', { pendientes: outboxPending }, 'DEGRADED');
    }

    // Chequear dead letters
    const deadLetters = await db.collection('outbox')
      .countDocuments({ status: 'DEAD_LETTER' });

    if (deadLetters > policies.alertaDeadLetters) {
      issues.push(`Dead letters: ${deadLetters}`);
      _emitPolicyShift('DEAD_LETTERS_DETECTADOS', { count: deadLetters }, 'WARNING');
    }

    // Chequear circuit breakers abiertos
    const { getAll } = require('../infrastructure/circuitBreaker');
    const circuits = getAll();
    const openCircuits = circuits.filter(c => c.state === STATES.OPEN);
    if (openCircuits.length > 0) {
      issues.push(`Circuits OPEN: ${openCircuits.map(c => c.circuitId).join(', ')}`);
    }

    // Emitir pulse al admin via socket
    if (io) {
      io.to('admins').emit('governance_pulse', {
        timestamp: new Date(),
        policies,
        issues,
        circuits: circuits.map(c => ({ id: c.circuitId, state: c.state, failures: c.failures })),
        outboxPending,
        deadLetters,
        healthy: issues.length === 0,
      });
    }

    global._governanceLastTick = Date.now();
    if (issues.length > 0) {
      console.warn('[Governance] ⚠️ Issues detectados:', issues.join(' | '));
    } else {
      console.log('[Governance] ✅ Sistema saludable');
    }

  } catch(e) {
    console.error('[Governance] Error en pulse:', e.message);
  }
}

// ── POLICY SHIFT EVENT ───────────────────────────────────────
// Autoridad máxima — puede degradar, throttlear, activar fallback

function _emitPolicyShift(reason, data, severity = 'WARNING') {
  emitEvent({
    entityType: 'governance',
    type: 'POLICY_SHIFT',
    aggregateId: 'system',
    payload: {
      reason,
      severity,
      data,
      policiesSnapshot: { ...policies },
      timestamp: new Date(),
    },
  });
  console.warn(`[Governance] 🔴 PolicyShiftEvent: ${reason} [${severity}]`);
}

function activarModoEmergencia(motivo) {
  policies.modoEmergencia = true;
  policies.throttleActivo = true;
  policies.fallbackActivo = true;
  policies.updatedAt = new Date();
  _emitPolicyShift('MODO_EMERGENCIA_ACTIVADO', { motivo }, 'CRITICAL');
  console.error('[Governance] 🚨 MODO EMERGENCIA ACTIVADO:', motivo);
}

function desactivarModoEmergencia() {
  policies.modoEmergencia = false;
  policies.throttleActivo = false;
  policies.fallbackActivo = false;
  policies.updatedAt = new Date();
  _emitPolicyShift('MODO_EMERGENCIA_DESACTIVADO', {}, 'INFO');
  console.log('[Governance] ✅ Modo emergencia desactivado');
}

function actualizarPolitica(key, value) {
  if (!(key in policies)) throw new Error(`Política desconocida: ${key}`);
  const prev = policies[key];
  policies[key] = value;
  policies.updatedAt = new Date();
  _emitPolicyShift('POLITICA_ACTUALIZADA', { key, from: prev, to: value }, 'INFO');
}

function getPolicies() { return { ...policies }; }

function stop() {
  if (_pulseInterval) { clearInterval(_pulseInterval); _pulseInterval = null; }
}

module.exports = { startPulse, activarModoEmergencia, desactivarModoEmergencia, actualizarPolitica, getPolicies, stop };
