/**
 * B19 Policy Evaluator — módulo compartido
 * Usado por: ControlPlaneGateway + PolicySimulationEngine
 *
 * Invariantes:
 *   - PURO: no muta ctx (trabaja sobre copia local)
 *   - DETERMINISTA: mismo input → mismo output siempre
 *   - SIN side effects: no emite, no escribe, no loguea
 *   - Única fuente de verdad para matching + pricing
 */

'use strict';

// ── Matching de condiciones (AND entre todas)
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

// ── Matching de scope (rubro, zona, hora con wrap)
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

/**
 * applyActions(actions, basePrice, ctx) → { frozen, reason, finalPrice, breakdown }
 *
 * PURO: recibe ctx pero NO lo muta.
 * Trabaja sobre copia interna para adjust_factor.
 */
function applyActions(actions, basePrice, ctx) {
  let price       = basePrice;
  const breakdown = [];
  const _ctx      = { ...ctx };   // copia — el original nunca se toca

  for (const action of actions) {
    switch (action.type) {
      case 'multiply_price': {
        const factor = action.params?.factor ?? 1;
        price *= factor;
        breakdown.push({ op: 'multiply', factor, rule: action._rule });
        break;
      }
      case 'cap_price': {
        const max = action.params?.max;
        if (max !== undefined && price > max) {
          price = max;
          breakdown.push({ op: 'cap', max, rule: action._rule });
        }
        break;
      }
      case 'floor_price': {
        const min = action.params?.min;
        if (min !== undefined && price < min) {
          price = min;
          breakdown.push({ op: 'floor', min, rule: action._rule });
        }
        break;
      }
      case 'freeze_dispatch':
        return {
          frozen:     true,
          reason:     action.params?.reason || 'policy_freeze',
          finalPrice: Math.round(price),
          breakdown,
        };
      case 'adjust_factor': {
        const field = action.params?.field;
        if (field && _ctx[field] !== undefined) {
          _ctx[field] = action.params.value;
          breakdown.push({ op: 'adjust_factor', field, value: action.params.value, rule: action._rule });
        }
        break;
      }
      default:
        break;
    }
  }

  return { frozen: false, reason: null, finalPrice: Math.round(price), breakdown };
}

/**
 * evaluateRules(rules, ctx, basePrice)
 * → { frozen, reason, finalPrice, breakdown, appliedRules, activeActions, shadowActions }
 *
 * Separa active de shadow — shadow se reporta pero no se aplica.
 */
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

  const { frozen, reason, finalPrice, breakdown } =
    applyActions(activeActions, basePrice, ctx);

  return { frozen, reason, finalPrice, breakdown, appliedRules, activeActions, shadowActions };
}

/**
 * buildContext(event) — Context Builder único compartido
 * Única fuente de verdad para normalización de eventos.
 * Mismo output garantizado para gateway y simulator.
 */
function buildContext(event) {
  const {
    rubro, zona, pedidoId, clienteId, workerId,
    precio_base, hora,
    cancellation_rate, workers_activos,
    factor_demanda, factor_zona, factor_tiempo, factor_saturacion,
    ...extra
  } = event || {};

  return {
    // Identidad
    pedidoId:  pedidoId  || null,
    clienteId: clienteId || null,
    workerId:  workerId  || null,

    // Mercado
    rubro:       rubro      || 'generico',
    zona:        zona       || 'desconocida',
    hora:        hora       ?? new Date().getHours(),
    precio_base: precio_base ?? 0,

    // Factores Aladín
    factor_demanda:    factor_demanda    ?? 1.0,
    factor_zona:       factor_zona       ?? 1.0,
    factor_tiempo:     factor_tiempo     ?? 1.0,
    factor_saturacion: factor_saturacion ?? 1.0,

    // Señales de estabilidad
    workers_activos:   workers_activos   ?? 0,
    cancellation_rate: cancellation_rate ?? 0,

    // Timestamp para auditoría
    _ts: Date.now(),
    ...extra,
  };
}

module.exports = { buildContext, evaluateRules, matchesScope, matchesConditions, applyActions };
