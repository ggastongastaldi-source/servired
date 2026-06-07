/**
 * B19 Policy Simulation Engine
 * Motor contrafactual — what-if engine acoplado al ControlPlaneGateway.
 *
 * Invariantes:
 *   - NO modifica gateway
 *   - NO escribe en DB
 *   - NO emite eventos
 *   - Determinista: evaluación pura, misma semántica que producción
 *   - Reimplementa matching localmente para evitar side effects del policyEngine
 */

'use strict';
const { buildContext, evaluateRules } = require('./policyEvaluator');

const PolicyRule = require('../models/PolicyRule');
const gateway    = require('./controlPlaneGateway');

// ── Caché local de reglas activas (TTL 30s — más corto que el engine real)
let _simCache = { rules: [], ts: 0 };
const SIM_CACHE_TTL = 30 * 1000;

const { requireDB } = require('../config/database');
async function _fetchActiveRules() {
  await requireDB();
  const now = Date.now();
  if (now - _simCache.ts < SIM_CACHE_TTL) return _simCache.rules;
  const rules = await PolicyRule
    .find({ status: 'active' })
    .sort({ priority: 1 })
    .lean();
  _simCache = { rules, ts: now };
  return rules;
}

// ── Matching local (idéntica semántica al gateway, sin acoplamiento)
function _matchesConditions(rule, ctx) {
  if (!rule.conditions || rule.conditions.length === 0) return true;
  return rule.conditions.every(c => {
    const val = ctx[c.field];
    if (val === undefined) return false;
    switch (c.operator) {
      case 'gt':      return val >  c.value;
      case 'gte':     return val >= c.value;
      case 'lt':      return val <  c.value;
      case 'lte':     return val <= c.value;
      case 'eq':      return val === c.value;
      case 'in':      return Array.isArray(c.value) && c.value.includes(val);
      case 'between': return Array.isArray(c.value) && val >= c.value[0] && val <= c.value[1];
      default:        return false;
    }
  });
}

function _matchesScope(rule, ctx) {
  const s = rule.scope || {};
  if (s.rubros?.length > 0 && !s.rubros.includes(ctx.rubro))  return false;
  if (s.zonas?.length  > 0 && !s.zonas.includes(ctx.zona))    return false;
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

// ── Aplicar acciones de pricing sobre precio base
function _applyActions(actions, basePrice, ctx) {
  let price = basePrice;
  const breakdown = [];

  for (const action of actions) {
    switch (action.type) {
      case 'multiply_price':
        price *= (action.params?.factor ?? 1);
        breakdown.push({ op: 'multiply', factor: action.params?.factor, rule: action._rule });
        break;
      case 'cap_price':
        if (price > action.params?.max) {
          price = action.params.max;
          breakdown.push({ op: 'cap', max: action.params.max, rule: action._rule });
        }
        break;
      case 'floor_price':
        if (price < action.params?.min) {
          price = action.params.min;
          breakdown.push({ op: 'floor', min: action.params.min, rule: action._rule });
        }
        break;
      case 'freeze_dispatch':
        return { frozen: true, reason: action.params?.reason || 'sim_freeze', price, breakdown };
      case 'adjust_factor':
        if (ctx[action.params?.field] !== undefined) {
          ctx[action.params.field] = action.params.value;
          breakdown.push({ op: 'adjust_factor', field: action.params.field, rule: action._rule });
        }
        break;
      default:
        break;
    }
  }
  return { frozen: false, price: Math.round(price), breakdown };
}

// ── Evaluar un conjunto de reglas contra contexto
function _evaluateRules(rules, ctx, basePrice) {
  const appliedRules = [];
  const activeActions = [];

  for (const rule of rules) {
    if (!_matchesScope(rule, ctx))      continue;
    if (!_matchesConditions(rule, ctx)) continue;
    appliedRules.push({ ruleId: rule.ruleId, version: rule.version });
    rule.actions.forEach(a => activeActions.push({ ...a, _rule: rule.ruleId }));
  }

  const { frozen, reason, price, breakdown } = _applyActions(activeActions, basePrice, { ...ctx });

  return { frozen, reason, finalPrice: price, breakdown, appliedRules };
}

// ──────────────────────────────────────────────────────────────────────────────
// simulate(event, hypothesis)
//
// hypothesis = {
//   mode: "merge" | "replace",
//   overrideRules: []   ← reglas hipotéticas (mismo schema que PolicyRule)
// }
// ──────────────────────────────────────────────────────────────────────────────
async function simulate(event, hypothesis = {}) {
  const ctx       = await gateway.buildContext(event);
  const basePrice = ctx.precio_base || 0;

  const { mode = 'merge', overrideRules = [] } = hypothesis;

  let rules;
  if (mode === 'replace') {
    rules = overrideRules;
  } else {
    // merge: activas de DB + hipotéticas (hipotéticas tienen prioridad si mismo ruleId)
    const dbRules = await _fetchActiveRules();
    const overrideIds = new Set(overrideRules.map(r => r.ruleId));
    const base = dbRules.filter(r => !overrideIds.has(r.ruleId));
    rules = [...base, ...overrideRules].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  const result = _evaluateRules(rules, ctx, basePrice);

  return {
    ctx,
    mode,
    overrideCount: overrideRules.length,
    ...result,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// replayHistory(events, hypothesis)
// Corre evaluación real vs hipotética sobre un batch de eventos históricos.
// ──────────────────────────────────────────────────────────────────────────────
async function replayHistory(events, hypothesis = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('replayHistory requiere array de eventos no vacío');
  }

  const details = [];
  let actualPriceSum    = 0, actualFreezes    = 0;
  let simPriceSum       = 0, simFreezes       = 0;
  let actualPriceCount  = 0, simPriceCount    = 0;

  for (const event of events) {
    // ── Evaluación real (via gateway — no ejecuta efectos, solo evalúa)
    const ctx    = await gateway.buildContext(event);
    const actual = await gateway.evaluate(ctx);

    const actualFinalPrice = actual.pricing?.finalPrice ?? ctx.precio_base ?? 0;
    const actualFrozen     = actual.frozen ?? false;

    if (actualFinalPrice > 0) { actualPriceSum += actualFinalPrice; actualPriceCount++; }
    if (actualFrozen) actualFreezes++;

    // ── Evaluación simulada
    const sim = await simulate(event, hypothesis);

    if (sim.finalPrice > 0) { simPriceSum += sim.finalPrice; simPriceCount++; }
    if (sim.frozen) simFreezes++;

    details.push({
      event:           event,
      actual:          { finalPrice: actualFinalPrice, frozen: actualFrozen, appliedRules: actual.appliedRules },
      simulated:       { finalPrice: sim.finalPrice,   frozen: sim.frozen,   appliedRules: sim.appliedRules },
      priceDelta:      sim.finalPrice - actualFinalPrice,
      priceDeltaPct:   actualFinalPrice > 0
                         ? +((( sim.finalPrice - actualFinalPrice) / actualFinalPrice) * 100).toFixed(2)
                         : null,
      freezeChanged:   actualFrozen !== sim.frozen,
    });
  }

  const actualAvgPrice    = actualPriceCount > 0 ? Math.round(actualPriceSum / actualPriceCount) : 0;
  const simulatedAvgPrice = simPriceCount    > 0 ? Math.round(simPriceSum    / simPriceCount)    : 0;
  const n                 = events.length;

  return {
    summary: {
      totalEventsEvaluated: n,
      hypothesis:           hypothesis,
      actualAvgPrice,
      simulatedAvgPrice,
      priceDeltaPercent:    actualAvgPrice > 0
                              ? +((( simulatedAvgPrice - actualAvgPrice) / actualAvgPrice) * 100).toFixed(2)
                              : null,
      actualFreezeRate:     +((actualFreezes / n) * 100).toFixed(2),
      simulatedFreezeRate:  +((simFreezes    / n) * 100).toFixed(2),
      freezeDeltaPct:       +(((simFreezes - actualFreezes) / Math.max(n, 1)) * 100).toFixed(2),
    },
    details,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// driftSnapshot() — para el Policy Drift Radar del dashboard
// Corre un batch de eventos canónicos y devuelve el delta vs producción.
// ──────────────────────────────────────────────────────────────────────────────
const CANONICAL_EVENTS = [
  { rubro: 'electricidad',    zona: 'la_matanza', precio_base: 4500, hora: 10, factor_demanda: 1.0 },
  { rubro: 'plomería',        zona: 'lanús',      precio_base: 6000, hora: 14, factor_demanda: 1.5 },
  { rubro: 'limpieza_hogar',  zona: 'morón',      precio_base: 3000, hora: 22, factor_demanda: 0.9 },
  { rubro: 'gasista',         zona: 'tigre',      precio_base: 8000, hora: 23, factor_demanda: 2.1 },
  { rubro: 'pintura',         zona: 'quilmes',    precio_base: 5000, hora:  2, factor_demanda: 1.2 },
  { rubro: 'electricidad',    zona: 'la_matanza', precio_base: 4500, hora: 10, factor_demanda: 1.0, workers_activos: 55 },
];

async function driftSnapshot(hypothesis = {}) {
  const result = await replayHistory(CANONICAL_EVENTS, hypothesis);
  return {
    ts:      Date.now(),
    summary: result.summary,
    perEvent: result.details.map(d => ({
      rubro:         d.event.rubro,
      zona:          d.event.zona,
      hora:          d.event.hora,
      actualPrice:   d.actual.finalPrice,
      simPrice:      d.simulated.finalPrice,
      deltaPct:      d.priceDeltaPct,
      freezeChanged: d.freezeChanged,
    })),
  };
}

module.exports = { simulate, replayHistory, driftSnapshot, CANONICAL_EVENTS };
