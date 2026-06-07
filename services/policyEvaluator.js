/**
 * B19 Policy Evaluator — v3.1 — Contrato effectType en trace
 *
 * CAMBIO v3.1:
 *   Cada entry del trace declara effectType explícito:
 *     'financial' | 'state' | 'control' | 'side_effect' | 'none'
 *
 *   Esto cierra el problema 2.1: π_f y π_s ya no infieren por op name
 *   sino que filtran por contrato declarado en el entry.
 *
 *   A1 — Trace Completeness: todo efecto observable está en trace
 *   A2 — Projection Determinism: π_f y π_s son funciones puras del trace
 *   A3 — Context Non-authority: ctx₀ es solo input inicial, nunca fuente de verdad
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

const TraceStatus = Object.freeze({
  EXECUTED:       'EXECUTED',
  NOOP:           'NOOP',
  SKIPPED_FREEZE: 'SKIPPED_FREEZE',
  TERMINAL:       'TERMINAL',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
});

// Contrato formal — cierra problema 2.1
const EffectType = Object.freeze({
  FINANCIAL:   'financial',    // modifica priceCents → aparece en breakdown
  STATE:       'state',        // modifica contextOut → aparece en π_s
  CONTROL:     'control',      // modifica flujo de ejecución (freeze)
  SIDE_EFFECT: 'side_effect',  // emit_event — externo al kernel
  NONE:        'none',         // noop o unknown
});

// ─────────────────────────────────────────────────────────────────────────────
// ARITMÉTICA EN CENTAVOS
// ─────────────────────────────────────────────────────────────────────────────

const SCALE = 100;
function toCents(ars)  { return Math.round(ars * SCALE); }
function toARS(cents)  { return Math.round(cents / SCALE * 100) / 100; }

// ─────────────────────────────────────────────────────────────────────────────
// MATCHING
// ─────────────────────────────────────────────────────────────────────────────

function matchesConditions(rule, ctx) {
  if (!rule.conditions || rule.conditions.length === 0) return true;
  return rule.conditions.every(c => {
    const val = ctx[c.field];
    if (val === undefined) return false;
    switch (c.operator) {
      case 'gt':      return val >   c.value;
      case 'gte':     return val >=  c.value;
      case 'lt':      return val <   c.value;
      case 'lte':     return val <=  c.value;
      case 'eq':      return val === c.value;
      case 'in':      return Array.isArray(c.value) && c.value.includes(val);
      case 'between': return Array.isArray(c.value) && val >= c.value[0] && val <= c.value[1];
      default:        return false;
    }
  });
}

function matchesScope(rule, ctx) {
  const s = rule.scope || {};
  if (s.rubros?.length > 0 && !s.rubros.includes(ctx.rubro)) return false;
  if (s.zonas?.length  > 0 && !s.zonas.includes(ctx.zona))   return false;
  if (s.hours) {
    const h = ctx.hora ?? new Date().getHours();
    if (s.hours.wrap) {
      if (!(h >= s.hours.from || h <= s.hours.to)) return false;
    } else {
      if (h < s.hours.from || h > s.hours.to)      return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE TRANSICIÓN δ(S, action) → S'
// Cada entry de trace declara effectType — contrato formal, no heurística
// ─────────────────────────────────────────────────────────────────────────────

function _transition(S, action) {
  const ruleId = action._rule || null;
  const op     = action.type  || 'unknown';

  if (S.frozen) {
    return {
      ...S,
      trace: [...S.trace, {
        ruleId,
        op,
        status:        TraceStatus.SKIPPED_FREEZE,
        effectType:    EffectType.NONE,
        causalBlocker: S.freezeSource,
      }],
    };
  }

  switch (action.type) {

    case 'multiply_price': {
      const factor    = action.params?.factor ?? 1;
      const prev      = S.priceCents;
      const next      = Math.round(prev * factor);
      const changed   = next !== prev;
      const entry = {
        ruleId, op,
        status:      changed ? TraceStatus.EXECUTED : TraceStatus.NOOP,
        effectType:  changed ? EffectType.FINANCIAL  : EffectType.NONE,
        factor,
        priceBefore: toARS(prev),
        priceAfter:  toARS(next),
      };
      return {
        ...S,
        priceCents: next,
        trace:      [...S.trace, entry],
        breakdown:  changed
          ? [...S.breakdown, { op: 'multiply', factor, rule: ruleId,
                               priceBefore: toARS(prev), priceAfter: toARS(next) }]
          : S.breakdown,
      };
    }

    case 'cap_price': {
      const maxARS   = action.params?.max;
      const maxCents = maxARS !== undefined ? toCents(maxARS) : null;
      const prev     = S.priceCents;
      const apply    = maxCents !== null && prev > maxCents;
      const next     = apply ? maxCents : prev;
      const entry = {
        ruleId, op,
        status:      apply ? TraceStatus.EXECUTED : TraceStatus.NOOP,
        effectType:  apply ? EffectType.FINANCIAL  : EffectType.NONE,
        max:         maxARS,
        priceBefore: toARS(prev),
        priceAfter:  toARS(next),
      };
      return {
        ...S,
        priceCents: next,
        trace:      [...S.trace, entry],
        breakdown:  apply
          ? [...S.breakdown, { op: 'cap', max: maxARS, rule: ruleId,
                               priceBefore: toARS(prev), priceAfter: toARS(next) }]
          : S.breakdown,
      };
    }

    case 'floor_price': {
      const minARS   = action.params?.min;
      const minCents = minARS !== undefined ? toCents(minARS) : null;
      const prev     = S.priceCents;
      const apply    = minCents !== null && prev < minCents;
      const next     = apply ? minCents : prev;
      const entry = {
        ruleId, op,
        status:      apply ? TraceStatus.EXECUTED : TraceStatus.NOOP,
        effectType:  apply ? EffectType.FINANCIAL  : EffectType.NONE,
        min:         minARS,
        priceBefore: toARS(prev),
        priceAfter:  toARS(next),
      };
      return {
        ...S,
        priceCents: next,
        trace:      [...S.trace, entry],
        breakdown:  apply
          ? [...S.breakdown, { op: 'floor', min: minARS, rule: ruleId,
                               priceBefore: toARS(prev), priceAfter: toARS(next) }]
          : S.breakdown,
      };
    }

    case 'freeze_dispatch': {
      const reason = action.params?.reason || 'policy_freeze';
      return {
        ...S,
        frozen:       true,
        freezeSource: ruleId,
        trace: [...S.trace, {
          ruleId, op,
          status:        TraceStatus.TERMINAL,
          effectType:    EffectType.CONTROL,
          reason,
          priceAtFreeze: toARS(S.priceCents),
        }],
      };
    }

    case 'adjust_factor': {
      const field = action.params?.field;
      const value = action.params?.value;
      const valid = field != null;
      return {
        ...S,
        trace: [...S.trace, {
          ruleId, op,
          status:     valid ? TraceStatus.EXECUTED : TraceStatus.NOOP,
          effectType: valid ? EffectType.STATE      : EffectType.NONE,
          field,
          value,
          reason:     !valid ? 'no_field_specified' : undefined,
        }],
      };
    }

    case 'emit_event': {
      return {
        ...S,
        trace: [...S.trace, {
          ruleId, op,
          status:     TraceStatus.EXECUTED,
          effectType: EffectType.SIDE_EFFECT,
          eventType:  action.params?.type,
        }],
      };
    }

    default: {
      return {
        ...S,
        trace: [...S.trace, {
          ruleId, op,
          status:     TraceStatus.UNKNOWN_ACTION,
          effectType: EffectType.NONE,
        }],
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROYECCIONES — basadas en effectType, no en op name (A2 cerrado)
// ─────────────────────────────────────────────────────────────────────────────

// π_s: state projection — filtra por contrato, no por heurística de op
function _projectState(ctx0, trace) {
  return trace
    .filter(e => e.effectType === EffectType.STATE && e.status === TraceStatus.EXECUTED)
    .reduce((acc, e) => ({ ...acc, [e.field]: e.value }), { ...ctx0 });
}

// π_f: financial projection — ya garantizada por breakdown en δ
// Se expone directamente desde S.breakdown

// ─────────────────────────────────────────────────────────────────────────────
// APPLY ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function applyActions(actions, basePrice, ctx) {
  let S = {
    priceCents:   toCents(basePrice),
    frozen:       false,
    freezeSource: null,
    trace:        [],
    breakdown:    [],
  };

  for (const action of actions) {
    S = _transition(S, action);
  }

  const contextOut = _projectState(ctx, S.trace);

  return {
    frozen:     S.frozen,
    reason:     S.frozen
      ? (S.trace.find(e => e.status === TraceStatus.TERMINAL)?.reason || 'policy_freeze')
      : null,
    finalPrice: toARS(S.priceCents),
    breakdown:  S.breakdown,
    trace:      S.trace,
    contextOut,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATE RULES — Fase A (ctx progresivo) + Fase B (pipeline)
// ─────────────────────────────────────────────────────────────────────────────

function evaluateRules(rules, ctx, basePrice) {
  const appliedRules  = [];
  const activeActions = [];
  const shadowActions = [];
  let ctxProgressive  = { ...ctx };

  for (const rule of rules) {
    if (!matchesScope(rule, ctxProgressive))      continue;
    if (!matchesConditions(rule, ctxProgressive)) continue;

    appliedRules.push({ ruleId: rule.ruleId, version: rule.version, status: rule.status });

    if (rule.status === 'active') {
      rule.actions.forEach(a => activeActions.push({ ...a, _rule: rule.ruleId }));
      rule.actions.forEach(a => {
        if (a.type === 'adjust_factor' && a.params?.field) {
          ctxProgressive = { ...ctxProgressive, [a.params.field]: a.params.value };
        }
      });
    } else if (rule.status === 'shadow') {
      shadowActions.push({ ruleId: rule.ruleId, actions: rule.actions });
    }
  }

  const { frozen, reason, finalPrice, breakdown, trace, contextOut } =
    applyActions(activeActions, basePrice, ctx);

  return {
    frozen, reason, finalPrice,
    breakdown, trace, contextOut,
    appliedRules, activeActions, shadowActions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

function buildContext(event) {
  const {
    rubro, zona, pedidoId, clienteId, workerId,
    precio_base, hora,
    cancellation_rate, workers_activos,
    factor_demanda, factor_zona, factor_tiempo, factor_saturacion,
    ...extra
  } = event || {};

  return {
    pedidoId:          pedidoId          || null,
    clienteId:         clienteId         || null,
    workerId:          workerId          || null,
    rubro:             rubro             || 'generico',
    zona:              zona              || 'desconocida',
    hora:              hora              ?? new Date().getHours(),
    precio_base:       precio_base       ?? 0,
    factor_demanda:    factor_demanda    ?? 1.0,
    factor_zona:       factor_zona       ?? 1.0,
    factor_tiempo:     factor_tiempo     ?? 1.0,
    factor_saturacion: factor_saturacion ?? 1.0,
    workers_activos:   workers_activos   ?? 0,
    cancellation_rate: cancellation_rate ?? 0,
    _ts: Date.now(),
    ...extra,
  };
}

module.exports = {
  buildContext,
  evaluateRules,
  matchesScope,
  matchesConditions,
  applyActions,
  TraceStatus,
  EffectType,
};
