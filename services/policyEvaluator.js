/**
 * B19 Policy Evaluator — v2 — Dual Ledger Model
 *
 * FINANCIAL LEDGER (breakdown): solo efectos financieros committed
 * EXECUTION LEDGER (trace):     registro completo de ejecución por acción
 *
 * Invariantes:
 *   - PURO: no muta ctx
 *   - DETERMINISTA: mismo input → mismo output
 *   - SIN side effects
 *   - API compatible con v1
 */

'use strict';

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
// APPLY ACTIONS — Dual Ledger
//
// breakdown → efectos financieros reales (committed)
// trace     → ejecución completa, acción por acción
//
// Regla de freeze:
//   - freeze_dispatch NO hace return inmediato
//   - activa flag _frozen interno
//   - acciones posteriores: no modifican precio, solo trace = skipped_by_freeze
// ─────────────────────────────────────────────────────────────────────────────

function applyActions(actions, basePrice, ctx) {
  let price      = basePrice;
  let _frozen    = false;
  let _reason    = null;
  const breakdown = [];   // FINANCIAL LEDGER — solo cambios reales al precio
  const trace     = [];   // EXECUTION LEDGER — toda la ejecución
  const _ctx      = { ...ctx };  // copia interna — original nunca se toca

  for (const action of actions) {
    const ruleId = action._rule || null;
    const op     = action.type  || 'unknown';

    // ── Acciones post-freeze: registrar y continuar sin efecto
    if (_frozen) {
      trace.push({ ruleId, op, status: 'skipped_by_freeze' });
      continue;
    }

    switch (action.type) {

      case 'multiply_price': {
        const factor    = action.params?.factor ?? 1;
        const pricePrev = price;
        price *= factor;
        const priceNext = Math.round(price);
        const changed   = priceNext !== Math.round(pricePrev);

        trace.push({ ruleId, op, status: changed ? 'executed' : 'noop',
                     factor, priceBefore: Math.round(pricePrev), priceAfter: priceNext });
        if (changed)
          breakdown.push({ op: 'multiply', factor, rule: ruleId,
                           priceBefore: Math.round(pricePrev), priceAfter: priceNext });
        break;
      }

      case 'cap_price': {
        const max       = action.params?.max;
        const pricePrev = price;
        if (max !== undefined && price > max) {
          price = max;
          trace.push({ ruleId, op, status: 'executed',
                       max, priceBefore: Math.round(pricePrev), priceAfter: Math.round(price) });
          breakdown.push({ op: 'cap', max, rule: ruleId,
                           priceBefore: Math.round(pricePrev), priceAfter: Math.round(price) });
        } else {
          trace.push({ ruleId, op, status: 'noop',
                       max, currentPrice: Math.round(price) });
        }
        break;
      }

      case 'floor_price': {
        const min       = action.params?.min;
        const pricePrev = price;
        if (min !== undefined && price < min) {
          price = min;
          trace.push({ ruleId, op, status: 'executed',
                       min, priceBefore: Math.round(pricePrev), priceAfter: Math.round(price) });
          breakdown.push({ op: 'floor', min, rule: ruleId,
                           priceBefore: Math.round(pricePrev), priceAfter: Math.round(price) });
        } else {
          trace.push({ ruleId, op, status: 'noop',
                       min, currentPrice: Math.round(price) });
        }
        break;
      }

      case 'freeze_dispatch': {
        _frozen = true;
        _reason = action.params?.reason || 'policy_freeze';
        // freeze NO modifica precio — solo registra estado terminal
        trace.push({ ruleId, op, status: 'terminal',
                     reason: _reason, priceAtFreeze: Math.round(price) });
        // NO break hacia fuera — el loop continúa para registrar skipped
        break;
      }

      case 'adjust_factor': {
        const field = action.params?.field;
        if (field && _ctx[field] !== undefined) {
          _ctx[field] = action.params.value;
          trace.push({ ruleId, op, status: 'executed',
                       field, value: action.params.value });
          // adjust_factor no modifica precio → no va a breakdown
        } else {
          trace.push({ ruleId, op, status: 'noop',
                       field, reason: field ? 'field_not_in_ctx' : 'no_field_specified' });
        }
        break;
      }

      case 'emit_event': {
        // fire-and-forget conceptual — no modifica precio, solo se registra
        trace.push({ ruleId, op, status: 'executed',
                     eventType: action.params?.type });
        break;
      }

      default: {
        trace.push({ ruleId, op, status: 'unknown_action' });
        break;
      }
    }
  }

  return {
    frozen:     _frozen,
    reason:     _reason,
    finalPrice: Math.round(price),
    breakdown,   // FINANCIAL LEDGER
    trace,       // EXECUTION LEDGER
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATE RULES
// Separa active (ejecutadas) de shadow (registradas, no aplicadas).
// ─────────────────────────────────────────────────────────────────────────────

function evaluateRules(rules, ctx, basePrice) {
  const appliedRules  = [];
  const activeActions = [];
  const shadowActions = [];

  for (const rule of rules) {
    if (!matchesScope(rule, ctx))      continue;
    if (!matchesConditions(rule, ctx)) continue;

    appliedRules.push({ ruleId: rule.ruleId, version: rule.version, status: rule.status });

    if (rule.status === 'active') {
      rule.actions.forEach(a => activeActions.push({ ...a, _rule: rule.ruleId }));
    } else if (rule.status === 'shadow') {
      shadowActions.push({ ruleId: rule.ruleId, actions: rule.actions });
    }
  }

  const { frozen, reason, finalPrice, breakdown, trace } =
    applyActions(activeActions, basePrice, ctx);

  return { frozen, reason, finalPrice, breakdown, trace, appliedRules, activeActions, shadowActions };
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

module.exports = { buildContext, evaluateRules, matchesScope, matchesConditions, applyActions };
