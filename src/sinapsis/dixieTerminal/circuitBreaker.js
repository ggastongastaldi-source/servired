// circuitBreaker.js — Sprint 3C-B
// Disparador automático de modo DEGRADED basado exclusivamente en PolicyFinding.
// INVARIANTE: entrada automática, salida manual (POST /degraded/off).
// No introduce métricas externas, no depende de Prometheus/OTel, no crea frameworks nuevos.
//
// Firma: evaluateCircuitBreaker(openFindings, getState, SystemState) → Promise<Decision>
//
// Decision = {
//   action : 'SET_DEGRADED_MODE' | 'NO_OP' | 'RECOVERY_CANDIDATE_EMITTED' | 'NONE',
//   reason : string,
//   trigger: object | null
// }

'use strict';

const { PolicyFinding } = require('./PolicyFinding');

const ACCUMULATION_THRESHOLD = 3;
const ACCUMULATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

// ── Regla B (Prioridad Máxima) ──────────────────────────────────────────────
function _checkCriticalRule(openFindings) {
  const found = openFindings.find(f => f.severity === 'CRITICAL' && f.status === 'OPEN');
  if (!found) return null;
  return {
    rule:   'CRITICAL_FINDING',
    detail: { findingId: found.findingId, findingRule: found.rule }
  };
}

// ── Regla A (Acumulación) ───────────────────────────────────────────────────
function _checkAccumulationRule(openFindings) {
  const now = Date.now();
  const groups = {};

  for (const f of openFindings) {
    if (f.status !== 'OPEN') continue;
    const detectedAt = f.detectedAt ? new Date(f.detectedAt).getTime() : null;
    if (detectedAt === null || (now - detectedAt) > ACCUMULATION_WINDOW_MS) continue;

    if (!groups[f.rule]) groups[f.rule] = [];
    groups[f.rule].push(f.findingId);
  }

  for (const [rule, findingIds] of Object.entries(groups)) {
    if (findingIds.length >= ACCUMULATION_THRESHOLD) {
      return {
        rule:   'ACCUMULATION',
        detail: { sameRule: rule, count: findingIds.length, findingIds }
      };
    }
  }
  return null;
}

// ── Recovery Candidate: evidencia, no automatización ────────────────────────
async function _emitRecoveryCandidateIfNeeded() {
  const existing = await PolicyFinding.findOne({
    rule: 'RECOVERY_CANDIDATE',
    status: 'OPEN'
  }).lean();

  if (existing) {
    return { action: 'NONE', reason: 'RECOVERY_CANDIDATE_ALREADY_OPEN', trigger: null };
  }

  const findingId = `RECOVERY_CANDIDATE:global:${Date.now()}`;
  await PolicyFinding.findOneAndUpdate(
    { findingId },
    { $setOnInsert: {
        findingId,
        rule:       'RECOVERY_CANDIDATE',
        severity:   'LOW',
        collection: 'cross',
        detail:     { note: 'Sin triggers activos durante ventana de estabilidad — candidato a recuperación manual' },
        status:     'OPEN',
        detectedAt: new Date()
    }},
    { upsert: true }
  );

  console.log(JSON.stringify({
    level: 'info', source: 'CIRCUIT_BREAKER',
    action: 'RECOVERY_CANDIDATE_EMITTED', findingId, timestamp: new Date().toISOString()
  }));

  return { action: 'RECOVERY_CANDIDATE_EMITTED', reason: 'STABILITY_WINDOW', trigger: { findingId } };
}

// ── Función principal ────────────────────────────────────────────────────────
async function evaluateCircuitBreaker(openFindings, getState, SystemState) {
  const state = await getState();

  const criticalTrigger     = _checkCriticalRule(openFindings);
  const accumulationTrigger = _checkAccumulationRule(openFindings);
  const trigger = criticalTrigger || accumulationTrigger;

  // ── Anti-loop obligatorio ──────────────────────────────────────────────
  if (state.mode === 'DEGRADED') {
    if (trigger) {
      console.log(JSON.stringify({
        level: 'info', source: 'CIRCUIT_BREAKER',
        action: 'NO_OP', reason: 'ALREADY_DEGRADED', trigger, timestamp: new Date().toISOString()
      }));
      return { action: 'NO_OP', reason: 'ALREADY_DEGRADED', trigger };
    }
    return await _emitRecoveryCandidateIfNeeded();
  }

  // ── Estado NORMAL: evaluar entrada a DEGRADED ──────────────────────────
  if (trigger) {
    await SystemState.findByIdAndUpdate(
      'global',
      { mode: 'DEGRADED', reason: `AUTO:${trigger.rule}` },
      { upsert: true }
    );

    console.log(JSON.stringify({
      level: 'warn', source: 'CIRCUIT_BREAKER',
      action: 'SET_DEGRADED_MODE', reason: trigger.rule, trigger, timestamp: new Date().toISOString()
    }));

    return { action: 'SET_DEGRADED_MODE', reason: trigger.rule, trigger };
  }

  return { action: 'NONE', reason: 'NO_TRIGGER', trigger: null };
}

module.exports = { evaluateCircuitBreaker };
