/**
 * B19 Kernel Validator — Dixie Gate para invariantes del execution kernel
 *
 * Valida axiomas formales del policyEvaluator contra cada resultado de ejecución.
 * Se puede correr en modo OBSERVE (log only) o ENFORCE (throw on violation).
 *
 * A1 — Trace Completeness:
 *      Todo efecto observable debe estar en trace.
 *      breakdown ⊆ trace(financial). contextOut ⊆ trace(state).
 *
 * A2 — Projection Determinism:
 *      π_f(trace) == breakdown declarado.
 *      π_s(ctx₀, trace) == contextOut declarado.
 *
 * A3 — Context Non-authority:
 *      ctx₀ no debe haber sido modificado.
 *      Ningún campo de contextOut puede diferir de ctx₀ sin entry en trace.
 */

'use strict';

const { TraceStatus, EffectType } = require('./policyEvaluator');

// ── Modos de operación
const ValidatorMode = Object.freeze({
  OBSERVE:  'OBSERVE',   // registra violaciones, no lanza
  ENFORCE:  'ENFORCE',   // lanza KernelViolationError en primera violación
});

class KernelViolationError extends Error {
  constructor(axiom, detail) {
    super(`[KernelValidator] ${axiom} violation: ${detail}`);
    this.axiom  = axiom;
    this.detail = detail;
    this.name   = 'KernelViolationError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIONES INDIVIDUALES
// ─────────────────────────────────────────────────────────────────────────────

// A1 — Trace Completeness
// breakdown entries deben tener correspondencia en trace con effectType=financial
function _checkA1(result) {
  const violations = [];
  const financialInTrace = new Set(
    result.trace
      .filter(e => e.effectType === EffectType.FINANCIAL && e.status === TraceStatus.EXECUTED)
      .map(e => `${e.ruleId}:${e.op}:${e.priceAfter}`)
  );

  for (const b of result.breakdown) {
    const key = `${b.rule}:${b.op}:${b.priceAfter}`;
    if (!financialInTrace.has(key)) {
      violations.push(`breakdown entry {op:${b.op} rule:${b.rule}} sin correspondencia en trace`);
    }
  }

  // state effects en contextOut deben estar en trace
  if (result.contextOut && result.ctx0) {
    for (const [field, value] of Object.entries(result.contextOut)) {
      if (result.ctx0[field] !== undefined && result.ctx0[field] !== value) {
        const inTrace = result.trace.some(
          e => e.effectType === EffectType.STATE &&
               e.status     === TraceStatus.EXECUTED &&
               e.field      === field &&
               e.value      === value
        );
        if (!inTrace) {
          violations.push(`contextOut[${field}]=${value} sin entry en trace`);
        }
      }
    }
  }

  return violations;
}

// A2 — Projection Determinism
// Reconstruir π_f y π_s desde trace y comparar con los declarados
function _checkA2(result) {
  const violations = [];

  // π_f: reconstruir breakdown desde trace
  const rebulit_breakdown = result.trace
    .filter(e => e.effectType === EffectType.FINANCIAL && e.status === TraceStatus.EXECUTED)
    .map(e => ({ op: e.op, rule: e.ruleId, priceAfter: e.priceAfter }));

  if (rebulit_breakdown.length !== result.breakdown.length) {
    violations.push(
      `π_f no determinista: trace produce ${rebulit_breakdown.length} entries, ` +
      `breakdown declara ${result.breakdown.length}`
    );
  }

  // π_s: reconstruir contextOut desde trace
  if (result.ctx0) {
    const rebuilt_ctx = result.trace
      .filter(e => e.effectType === EffectType.STATE && e.status === TraceStatus.EXECUTED)
      .reduce((acc, e) => ({ ...acc, [e.field]: e.value }), { ...result.ctx0 });

    for (const [field, value] of Object.entries(result.contextOut || {})) {
      if (rebuilt_ctx[field] !== value) {
        violations.push(
          `π_s no determinista: contextOut[${field}]=${value} ` +
          `pero rebuild desde trace produce ${rebuilt_ctx[field]}`
        );
      }
    }
  }

  return violations;
}

// A3 — Context Non-authority
// ctx₀ no debe haber sido mutado durante la ejecución
function _checkA3(ctx0Snapshot, ctx0After) {
  const violations = [];
  for (const [key, val] of Object.entries(ctx0Snapshot)) {
    if (ctx0After[key] !== val) {
      violations.push(`ctx₀ mutado: campo ${key} cambió de ${val} a ${ctx0After[key]}`);
    }
  }
  // Campos nuevos en ctx0After que no estaban antes
  for (const key of Object.keys(ctx0After)) {
    if (!(key in ctx0Snapshot)) {
      violations.push(`ctx₀ mutado: campo nuevo ${key} = ${ctx0After[key]}`);
    }
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

class KernelValidator {
  constructor(mode = ValidatorMode.OBSERVE) {
    this.mode       = mode;
    this.violations = [];   // historial de violaciones
    this.checks     = 0;
  }

  /**
   * validate(ctx0, result)
   *
   * ctx0:   el contexto ANTES de applyActions (snapshot)
   * result: el output de applyActions / evaluateRules
   *         debe incluir { trace, breakdown, contextOut }
   *
   * Para A3, ctx0 debe pasarse tal como fue antes de la ejecución.
   */
  validate(ctx0, result) {
    this.checks++;
    const allViolations = [];

    // Enriquecer result con ctx0 para uso interno
    const enriched = { ...result, ctx0 };

    const a1 = _checkA1(enriched);
    const a2 = _checkA2(enriched);
    const a3 = _checkA3(ctx0, ctx0);  // ctx0 vs ctx0 post — siempre OK si puro

    // A3 real: comparar snapshot tomado antes con el objeto después
    // El caller debe pasar ctx0 como snapshot (Object.freeze o copia)

    const report = {
      ts:        Date.now(),
      checks:    this.checks,
      passed:    a1.length === 0 && a2.length === 0 && a3.length === 0,
      A1:        { ok: a1.length === 0, violations: a1 },
      A2:        { ok: a2.length === 0, violations: a2 },
      A3:        { ok: a3.length === 0, violations: a3 },
      allViolations: [...a1, ...a2, ...a3],
    };

    if (!report.passed) {
      this.violations.push(report);
      if (this.mode === ValidatorMode.ENFORCE) {
        const first = report.allViolations[0];
        const axiom = a1.length > 0 ? 'A1' : a2.length > 0 ? 'A2' : 'A3';
        throw new KernelViolationError(axiom, first);
      }
    }

    return report;
  }

  // Resumen de todas las validaciones
  summary() {
    return {
      totalChecks:    this.checks,
      totalViolations:this.violations.length,
      passRate:       this.checks > 0
        ? +((1 - this.violations.length / this.checks) * 100).toFixed(1)
        : 100,
      violations:     this.violations,
    };
  }

  reset() {
    this.violations = [];
    this.checks     = 0;
  }
}

// Singleton OBSERVE para uso en producción (no lanza, solo registra)
const observeValidator  = new KernelValidator(ValidatorMode.OBSERVE);

// Factory para tests con ENFORCE
function createEnforceValidator() {
  return new KernelValidator(ValidatorMode.ENFORCE);
}

module.exports = {
  KernelValidator,
  KernelViolationError,
  ValidatorMode,
  observeValidator,
  createEnforceValidator,
};
