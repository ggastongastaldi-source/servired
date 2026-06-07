/**
 * B19 Policy Evaluator — v3 — Deterministic Execution Kernel
 *
 * Modelo formal: KERNEL = (E, S₀, δ, π_f, π_s)
 *
 * FINANCIAL PROJECTION (breakdown): π_f(trace) — solo efectos financieros committed
 * STATE PROJECTION     (contextOut): π_s(ctx₀, trace) — derivada del trace, no de mutación
 * EXECUTION LOG        (trace): registro completo con TraceStatus enum
 * INTERRUPT OPERATOR   (freeze): corte causal con causalBlocker
 *
 * Invariantes:
 *   - PURO: no muta ctx₀
 *   - DETERMINISTA: mismo input → mismo output
 *   - CAUSAL: Fase A resuelve reglas con ctx progresivo
 *             Fase B ejecuta pipeline con δ
 *   - IDEMPOTENTE: aritmética en centavos (× SCALE) sin acumulación flotante
 *   - API compatible con v1/v2
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TRACE STATUS ENUM
// ─────────────────────────────────────────────────────────────────────────────

const TraceStatus = Object.freeze({
  EVALUATED:      'EVALUATED',      // regla evaluada, condiciones no matchearon
  EXECUTED:       'EXECUTED',       // acción ejecutó y produjo efecto real
  NOOP:           'NOOP',           // acción ejecutó, condición no se activó
  SKIPPED_FREEZE: 'SKIPPED_FREEZE', // bloqueada por freeze anterior
  TERMINAL:       'TERMINAL',       // la acción es el freeze
  UNKNOWN_ACTION: 'UNKNOWN_ACTION', // tipo no reconocido
});

// ─────────────────────────────────────────────────────────────────────────────
// ARITMÉTICA EN CENTAVOS (idempotencia financiera — IC-3)
// Elimina acumulación incremental de error flotante.
// ─────────────────────────────────────────────────────────────────────────────

const SCALE = 100; // 1 ARS = 100 centavos internos

function toCents(ars)   { return Math.round(ars  * SCALE); }
function toARS(cents)   { return Math.round(cents / SCALE * 100) / 100; }
function roundARS(ars)  { return toARS(toCents(ars)); }

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
// Estado S = { priceCents, frozen, freezeSource, trace, breakdown }
// PURA: no muta S, devuelve S' nuevo
// ─────────────────────────────────────────────────────────────────────────────

function _transition(S, action) {
  const ruleId = action._rule || null;
  const op     = action.type  || 'unknown';

  // ── Operador de corte causal: acciones post-freeze solo generan SKIPPED
  if (S.frozen) {
    return {
      ...S,
      trace: [...S.trace, {
        ruleId,
        op,
        status:        TraceStatus.SKIPPED_FREEZE,
        causalBlocker: S.freezeSource,
      }],
    };
  }

  switch (action.type) {

    case 'multiply_price': {
      const factor       = action.params?.factor ?? 1;
      const prevCents    = S.priceCents;
      // Composición en centavos: round(cents × factor) sin acumulación
      const nextCents    = Math.round(prevCents * factor);
      const changed      = nextCents !== prevCents;
      const entry = {
        ruleId, op,
        status:     changed ? TraceStatus.EXECUTED : TraceStatus.NOOP,
        factor,
        priceBefore: toARS(prevCents),
        priceAfter:  toARS(nextCents),
      };
      return {
        ...S,
        priceCents: nextCents,
        trace:      [...S.trace, entry],
        breakdown:  changed
          ? [...S.breakdown, { op: 'multiply', factor, rule: ruleId,
                               priceBefore: toARS(prevCents), priceAfter: toARS(nextCents) }]
          : S.breakdown,
      };
    }

    case 'cap_price': {
      const maxARS    = action.params?.max;
      const maxCents  = maxARS !== undefined ? toCents(maxARS) : null;
      const prevCents = S.priceCents;
      const apply     = maxCents !== null && prevCents > maxCents;
      const nextCents = apply ? maxCents : prevCents;
      const entry = {
        ruleId, op,
        status:      apply ? TraceStatus.EXECUTED : TraceStatus.NOOP,
        max:         maxARS,
        priceBefore: toARS(prevCents),
        priceAfter:  toARS(nextCents),
      };
      return {
        ...S,
        priceCents: nextCents,
        trace:      [...S.trace, entry],
        breakdown:  apply
          ? [...S.breakdown, { op: 'cap', max: maxARS, rule: ruleId,
                               priceBefore: toARS(prevCents), priceAfter: toARS(nextCents) }]
          : S.breakdown,
      };
    }

    case 'floor_price': {
      const minARS    = action.params?.min;
      const minCents  = minARS !== undefined ? toCents(minARS) : null;
      const prevCents = S.priceCents;
      const apply     = minCents !== null && prevCents < minCents;
      const nextCents = apply ? minCents : prevCents;
      const entry = {
        ruleId, op,
        status:      apply ? TraceStatus.EXECUTED : TraceStatus.NOOP,
        min:         minARS,
        priceBefore: toARS(prevCents),
        priceAfter:  toARS(nextCents),
      };
      return {
        ...S,
        priceCents: nextCents,
        trace:      [...S.trace, entry],
        breakdown:  apply
          ? [...S.breakdown, { op: 'floor', min: minARS, rule: ruleId,
                               priceBefore: toARS(prevCents), priceAfter: toARS(nextCents) }]
          : S.breakdown,
      };
    }

    case 'freeze_dispatch': {
      const reason = action.params?.reason || 'policy_freeze';
      return {
        ...S,
        frozen:      true,
        freezeSource: ruleId,
        trace: [...S.trace, {
          ruleId, op,
          status:        TraceStatus.TERMINAL,
          reason,
          priceAtFreeze: toARS(S.priceCents),
        }],
        // freeze NO modifica priceCents ni breakdown
      };
    }

    case 'adjust_factor': {
      const field = action.params?.field;
      const value = action.params?.value;
      const valid = field !== undefined && field !== null;
      // adjust_factor afecta contextOut (derivado del trace en π_s), no price
      return {
        ...S,
        trace: [...S.trace, {
          ruleId, op,
          status: valid ? TraceStatus.EXECUTED : TraceStatus.NOOP,
          field,
          value,
          reason: !valid ? 'no_field_specified' : undefined,
        }],
        // priceCents y breakdown sin cambio
      };
    }

    case 'emit_event': {
      return {
        ...S,
        trace: [...S.trace, {
          ruleId, op,
          status:    TraceStatus.EXECUTED,
          eventType: action.params?.type,
        }],
      };
    }

    default: {
      return {
        ...S,
        trace: [...S.trace, { ruleId, op, status: TraceStatus.UNKNOWN_ACTION }],
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE PROJECTION π_s(ctx₀, trace) → contextOut  (IC-1)
// Derivada del trace — no depende de _ctx mutable interno.
// ─────────────────────────────────────────────────────────────────────────────

function _projectState(ctx0, trace) {
  return trace.reduce((acc, entry) => {
    if (entry.op === 'adjust_factor' && entry.status === TraceStatus.EXECUTED) {
      return { ...acc, [entry.field]: entry.value };
    }
    return acc;
  }, { ...ctx0 });
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY ACTIONS — orquesta δ sobre pipeline de acciones
// ─────────────────────────────────────────────────────────────────────────────

function applyActions(actions, basePrice, ctx) {
  // Estado inicial S₀
  let S = {
    priceCents:  toCents(basePrice),
    frozen:      false,
    freezeSource: null,
    trace:       [],
    breakdown:   [],
  };

  // Fase B: ejecutar pipeline con δ
  for (const action of actions) {
    S = _transition(S, action);
  }

  // π_s: proyección de estado derivada del trace (no de mutación interna)
  const contextOut = _projectState(ctx, S.trace);

  return {
    frozen:     S.frozen,
    reason:     S.frozen
      ? (S.trace.find(e => e.status === TraceStatus.TERMINAL)?.reason || 'policy_freeze')
      : null,
    finalPrice: toARS(S.priceCents),
    breakdown:  S.breakdown,   // π_f: financial projection
    trace:      S.trace,       // execution log
    contextOut,                // π_s: state projection
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATE RULES — Fase A + Fase B con ctx progresivo  (IC-2)
//
// Fase A: resolución de reglas con ctx progresivo
//   cada regla ve el ctx producido por las reglas anteriores (adjust_factor)
// Fase B: delegada a applyActions con pipeline completo
// ─────────────────────────────────────────────────────────────────────────────

function evaluateRules(rules, ctx, basePrice) {
  const appliedRules  = [];
  const activeActions = [];
  const shadowActions = [];

  // Fase A — ctx progresivo para resolución causal
  let ctxProgressive = { ...ctx };

  for (const rule of rules) {
    if (!matchesScope(rule, ctxProgressive))      continue;
    if (!matchesConditions(rule, ctxProgressive)) continue;

    appliedRules.push({ ruleId: rule.ruleId, version: rule.version, status: rule.status });

    if (rule.status === 'active') {
      rule.actions.forEach(a => activeActions.push({ ...a, _rule: rule.ruleId }));

      // Actualizar ctxProgressive con adjust_factor inmediato
      // para que la siguiente regla en Fase A vea el estado actualizado
      rule.actions.forEach(a => {
        if (a.type === 'adjust_factor' && a.params?.field) {
          ctxProgressive = { ...ctxProgressive, [a.params.field]: a.params.value };
        }
      });
    } else if (rule.status === 'shadow') {
      shadowActions.push({ ruleId: rule.ruleId, actions: rule.actions });
    }
  }

  // Fase B — ejecutar pipeline completo sobre ctx₀ original
  const { frozen, reason, finalPrice, breakdown, trace, contextOut } =
    applyActions(activeActions, basePrice, ctx);

  return {
    frozen, reason, finalPrice,
    breakdown, trace, contextOut,
    appliedRules, activeActions, shadowActions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CONTEXT — única fuente de verdad
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
};
