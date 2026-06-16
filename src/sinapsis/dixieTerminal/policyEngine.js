// policyEngine.js — evaluador determinístico de Sprint 3B
// INVARIANTE: esta función no toca Mongo, no tiene side effects,
// no lanza excepciones de red. Solo recibe estado → devuelve decisiones.
//
// Firma: evaluate(findings, metrics) → Decision[]
//
// Decision = {
//   findingId : string,
//   action    : 'CLOSE_FINDING' | 'ACKNOWLEDGE_FINDING' | 'EMIT_ALERT' | 'NOOP',
//   reason    : string,
//   evidence  : object
// }

'use strict';

// ── Catálogo de razones ─────────────────────────────────────────────────────
const REASON = {
  BUS_RECOVERED:       'BUS_RECOVERED',
  CONDITION_RESOLVED:  'CONDITION_RESOLVED',
  STRUCTURAL:          'STRUCTURAL',
  INSUFFICIENT_DATA:   'INSUFFICIENT_DATA',
  NO_ACTION:           'NO_ACTION'
};

// ── Evaluadores por regla ───────────────────────────────────────────────────
// Cada evaluador recibe (finding, metrics) y devuelve una Decision.
// Si no sabe qué hacer → NOOP (nunca lanza, nunca omite).

const evaluators = {

  DIVERGENCE(finding, { busTotal, govTotal }) {
    // Condición original: busTotal==0 && govTotal>0
    // Resolución: bus se normalizó (busTotal>0 y govTotal>0)
    if (busTotal > 0 && govTotal > 0) {
      return {
        findingId: finding.findingId,
        action:    'CLOSE_FINDING',
        reason:    REASON.BUS_RECOVERED,
        evidence:  { busTotal, govTotal }
      };
    }
    // Bus sigue vacío — mantener abierto
    return {
      findingId: finding.findingId,
      action:    'NOOP',
      reason:    REASON.NO_ACTION,
      evidence:  { busTotal, govTotal }
    };
  },

  GAP_BUS(finding, { busTotal }) {
    // Gap detectado — si el bus tiene eventos es un gap histórico conocido
    // Lo marcamos ACKNOWLEDGE (no resuelto, pero registrado)
    if (busTotal > 0) {
      return {
        findingId: finding.findingId,
        action:    'ACKNOWLEDGE_FINDING',
        reason:    REASON.STRUCTURAL,
        evidence:  { busTotal, note: 'gap histórico — bus operativo' }
      };
    }
    return {
      findingId: finding.findingId,
      action:    'NOOP',
      reason:    REASON.INSUFFICIENT_DATA,
      evidence:  { busTotal }
    };
  },

  GAP_GOV(finding, { govTotal }) {
    if (govTotal > 0) {
      return {
        findingId: finding.findingId,
        action:    'ACKNOWLEDGE_FINDING',
        reason:    REASON.STRUCTURAL,
        evidence:  { govTotal, note: 'gap histórico — gov operativo' }
      };
    }
    return {
      findingId: finding.findingId,
      action:    'NOOP',
      reason:    REASON.INSUFFICIENT_DATA,
      evidence:  { govTotal }
    };
  },

  HASH_INVALID(finding, metrics) {
    // Hash inválido es evidencia de corrupción — nunca auto-cerrar
    return {
      findingId: finding.findingId,
      action:    'EMIT_ALERT',
      reason:    REASON.STRUCTURAL,
      evidence:  { sequence: finding.detail?.sequence, note: 'requiere revisión manual' }
    };
  },

  CHAIN_BROKEN(finding, metrics) {
    return {
      findingId: finding.findingId,
      action:    'EMIT_ALERT',
      reason:    REASON.STRUCTURAL,
      evidence:  { sequence: finding.detail?.sequence, note: 'requiere revisión manual' }
    };
  },

  GOV_INVALID(finding, metrics) {
    return {
      findingId: finding.findingId,
      action:    'EMIT_ALERT',
      reason:    REASON.STRUCTURAL,
      evidence:  { invalidCount: finding.detail?.invalidCount, note: 'requiere revisión manual' }
    };
  },

  OUT_OF_ORDER(finding, { busTotal }) {
    if (busTotal > 0) {
      return {
        findingId: finding.findingId,
        action:    'ACKNOWLEDGE_FINDING',
        reason:    REASON.STRUCTURAL,
        evidence:  { busTotal, note: 'secuencias históricas fuera de orden — bus operativo' }
      };
    }
    return {
      findingId: finding.findingId,
      action:    'NOOP',
      reason:    REASON.INSUFFICIENT_DATA,
      evidence:  { busTotal }
    };
  }
};

// ── Función principal ───────────────────────────────────────────────────────
// Pura: [Finding] × Metrics → Decision[]
// Sin awaits, sin mongoose, sin side effects.

function evaluate(findings, metrics) {
  return findings.map(finding => {
    const evaluator = evaluators[finding.rule];
    if (!evaluator) {
      return {
        findingId: finding.findingId,
        action:    'NOOP',
        reason:    REASON.NO_ACTION,
        evidence:  { note: `regla ${finding.rule} sin evaluador definido` }
      };
    }
    try {
      return evaluator(finding, metrics);
    } catch (e) {
      // El engine nunca propaga excepciones — degrada a NOOP
      return {
        findingId: finding.findingId,
        action:    'NOOP',
        reason:    REASON.NO_ACTION,
        evidence:  { error: e.message }
      };
    }
  });
}

module.exports = { evaluate };
