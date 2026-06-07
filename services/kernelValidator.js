/**
 * B19 Kernel Validator — Dixie Gate para invariantes del execution kernel
 *
 * A1 — Trace Completeness:
 *      Homomorfismo de proyección: cada breakdown entry justificado
 *      por trace FINANCIAL con mismo ruleId:op. NO priceAfter (es derivado).
 *
 * A2 — Projection Determinism:
 *      π_f(trace) == breakdown. π_s(ctx₀, trace) == contextOut.
 *      Ambas reconstruibles desde trace.
 *
 * A3 — Context Non-authority:
 *      ctx₀ es input inicial. contextOut es proyección derivada.
 *      Todo campo en contextOut que difiera de ctx₀ debe tener
 *      justificación en trace STATE.
 */

'use strict';

const { TraceStatus, EffectType } = require('./policyEvaluator');

const ValidatorMode = Object.freeze({
  OBSERVE: 'OBSERVE',
  ENFORCE: 'ENFORCE',
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
// A1 — Trace Completeness
// Identidad: ruleId:op (NO priceAfter — es derivado, no identidad)
// breakdown.rule == trace.ruleId (schemas distintos, normalizado aquí)
// ─────────────────────────────────────────────────────────────────────────────

function _checkA1(result) {
  const violations = [];

  // Conjunto de identidades financieras ejecutadas en trace
  // Usa ruleId (campo de trace) — breakdown usa 'rule'
  const financialInTrace = new Set(
    result.trace
      .filter(e =>
        e.effectType === EffectType.FINANCIAL &&
        e.status     === TraceStatus.EXECUTED
      )
      .map(e => `${e.ruleId}:${e.op}`)
  );

  // Cada breakdown entry debe tener justificante en trace
  for (const b of result.breakdown) {
    const key = `${b.rule}:${b.op}`;  // normalizar: breakdown.rule → trace.ruleId
    if (!financialInTrace.has(key)) {
      violations.push(
        `breakdown entry {op:${b.op} rule:${b.rule}} sin trace FINANCIAL justificante`
      );
    }
  }

  // Cardinalidad: breakdown no puede exceder trace financiero
  if (result.breakdown.length > financialInTrace.size) {
    violations.push(
      `breakdown (${result.breakdown.length}) excede trace financiero (${financialInTrace.size})`
    );
  }

  // State effects en contextOut deben estar justificados en trace STATE
  if (result.contextOut && result.ctx0) {
    for (const [field, value] of Object.entries(result.contextOut)) {
      if (result.ctx0[field] !== undefined && result.ctx0[field] !== value) {
        const justified = result.trace.some(
          e => e.effectType === EffectType.STATE &&
               e.status     === TraceStatus.EXECUTED &&
               e.field      === field &&
               e.value      === value
        );
        if (!justified) {
          violations.push(`contextOut[${field}]=${value} sin entry STATE justificante en trace`);
        }
      }
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// A2 — Projection Determinism
// Reconstruir π_f y π_s desde trace — deben coincidir con los declarados
// ─────────────────────────────────────────────────────────────────────────────

function _checkA2(result) {
  const violations = [];

  // π_f: reconstruir conteo financiero desde trace
  const traceFinancialCount = result.trace.filter(
    e => e.effectType === EffectType.FINANCIAL && e.status === TraceStatus.EXECUTED
  ).length;

  if (result.breakdown.length !== traceFinancialCount) {
    violations.push(
      `π_f no determinista: trace produce ${traceFinancialCount} entries, ` +
      `breakdown declara ${result.breakdown.length}`
    );
  }

  // π_s: reconstruir contextOut desde trace y comparar
  if (result.ctx0) {
    const rebuilt = result.trace
      .filter(e => e.effectType === EffectType.STATE && e.status === TraceStatus.EXECUTED)
      .reduce((acc, e) => ({ ...acc, [e.field]: e.value }), { ...result.ctx0 });

    for (const [field, value] of Object.entries(result.contextOut || {})) {
      if (rebuilt[field] !== value) {
        violations.push(
          `π_s no determinista: contextOut[${field}]=${value} ` +
          `pero rebuild desde trace produce ${rebuilt[field]}`
        );
      }
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// A3 — Context Non-authority
// ctx₀ es input inicial — contextOut es proyección derivada del trace.
// Todo cambio en contextOut vs ctx₀ debe estar justificado en trace STATE.
// ─────────────────────────────────────────────────────────────────────────────

function _checkA3(ctx0, contextOut, trace) {
  const violations = [];

  for (const [field, value] of Object.entries(contextOut)) {
    if (ctx0[field] !== undefined && ctx0[field] !== value) {
      // Campo modificado — debe tener justificación en trace STATE
      const justified = trace.some(
        e => e.effectType === EffectType.STATE &&
             e.status     === TraceStatus.EXECUTED &&
             e.field      === field &&
             e.value      === value
      );
      if (!justified) {
        violations.push(
          `ctx₀ authority violation: contextOut[${field}] cambió ` +
          `de ${ctx0[field]} a ${value} sin justificación en trace`
        );
      }
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
    this.violations = [];
    this.checks     = 0;
  }

  /**
   * validate(ctx0, result)
   * ctx0:   snapshot del contexto ANTES de applyActions
   * result: output de applyActions/evaluateRules { trace, breakdown, contextOut }
   */
  validate(ctx0, result) {
    this.checks++;

    const enriched = { ...result, ctx0 };

    const a1 = _checkA1(enriched);
    const a2 = _checkA2(enriched);
    const a3 = _checkA3(ctx0, result.contextOut || {}, result.trace || []);

    const report = {
      ts:            Date.now(),
      checks:        this.checks,
      passed:        a1.length === 0 && a2.length === 0 && a3.length === 0,
      A1:            { ok: a1.length === 0, violations: a1 },
      A2:            { ok: a2.length === 0, violations: a2 },
      A3:            { ok: a3.length === 0, violations: a3 },
      allViolations: [...a1, ...a2, ...a3],
    };

    if (!report.passed) {
      this.violations.push(report);
      if (this.mode === ValidatorMode.ENFORCE) {
        const axiom = a1.length > 0 ? 'A1' : a2.length > 0 ? 'A2' : 'A3';
        throw new KernelViolationError(axiom, report.allViolations[0]);
      }
    }

    return report;
  }

  summary() {
    return {
      totalChecks:     this.checks,
      totalViolations: this.violations.length,
      passRate:        this.checks > 0
        ? +((1 - this.violations.length / this.checks) * 100).toFixed(1)
        : 100,
      violations:      this.violations,
    };
  }

  reset() { this.violations = []; this.checks = 0; }
}

const observeValidator = new KernelValidator(ValidatorMode.OBSERVE);
function createEnforceValidator() { return new KernelValidator(ValidatorMode.ENFORCE); }

module.exports = {
  KernelValidator,
  KernelViolationError,
  ValidatorMode,
  observeValidator,
  createEnforceValidator,
};
