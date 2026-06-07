/**
 * B19 Policy Engine — Runtime Service
 *
 * Flujo:
 *   contexto → evaluateContext(ctx) → [acciones ordenadas por prioridad]
 *
 * Invariantes:
 *   - Solo reglas 'active' se ejecutan en producción
 *   - Reglas 'shadow' se evalúan pero no se aplican (logging only)
 *   - Rollback determinista: siempre hay una versión anterior conocida
 *   - Toda activación queda registrada en PolicyAuditLog
 */

const PolicyRule   = require('../models/PolicyRule');
const { PolicyRuleCreateSchema, PolicyActivateSchema } = require('../config/policySchemas');

// ── Caché en memoria (TTL 60s) para evitar query en cada pedido
let _cache = { rules: [], ts: 0 };
const CACHE_TTL = 60 * 1000;

async function _loadRules() {
  const now = Date.now();
  if (now - _cache.ts < CACHE_TTL) return _cache.rules;

  const rules = await PolicyRule
    .find({ status: { $in: ['active', 'shadow'] } })
    .sort({ priority: 1 })
    .lean();

  _cache = { rules, ts: now };
  return rules;
}

function _invalidateCache() {
  _cache.ts = 0;
}

// ── Evaluar condiciones de una regla contra el contexto
function _matchesConditions(rule, ctx) {
  if (!rule.conditions || rule.conditions.length === 0) return true;
  return rule.conditions.every(c => {
    const val = ctx[c.field];
    if (val === undefined) return false;
    switch (c.operator) {
      case 'gt':      return val > c.value;
      case 'gte':     return val >= c.value;
      case 'lt':      return val < c.value;
      case 'lte':     return val <= c.value;
      case 'eq':      return val === c.value;
      case 'in':      return Array.isArray(c.value) && c.value.includes(val);
      case 'between': return Array.isArray(c.value) && val >= c.value[0] && val <= c.value[1];
      default:        return false;
    }
  });
}

// ── Evaluar scope (rubro, zona, hora)
function _matchesScope(rule, ctx) {
  const s = rule.scope || {};

  if (s.rubros && s.rubros.length > 0) {
    if (!s.rubros.includes(ctx.rubro)) return false;
  }
  if (s.zonas && s.zonas.length > 0) {
    if (!s.zonas.includes(ctx.zona)) return false;
  }
  if (s.hours) {
    const h = ctx.hora ?? new Date().getHours();
    if (h < s.hours.from || h > s.hours.to) return false;
  }
  return true;
}

/**
 * evaluateContext(ctx) → { activeActions, shadowActions, appliedRules }
 *
 * ctx = {
 *   rubro:         string,
 *   zona:          string,
 *   hora:          number (0-23),
 *   factor_demanda: number,
 *   precio_base:   number,
 *   workers_activos: number,
 *   ... cualquier campo que usen las condiciones
 * }
 */
async function evaluateContext(ctx) {
  const rules = await _loadRules();

  const activeActions = [];
  const shadowActions = [];
  const appliedRules  = [];

  for (const rule of rules) {
    if (!_matchesScope(rule, ctx))      continue;
    if (!_matchesConditions(rule, ctx)) continue;

    appliedRules.push({ ruleId: rule.ruleId, version: rule.version, status: rule.status });

    if (rule.status === 'active') {
      rule.actions.forEach(a => activeActions.push({ ...a, _rule: rule.ruleId }));
    } else if (rule.status === 'shadow') {
      // Loguear pero no ejecutar
      shadowActions.push({ ruleId: rule.ruleId, actions: rule.actions });
    }
  }

  return { activeActions, shadowActions, appliedRules };
}

/**
 * applyPricing(ctx, basePrice) → { finalPrice, breakdown, appliedRules }
 * Aplica las acciones de pricing en orden de prioridad.
 */
async function applyPricing(ctx, basePrice) {
  const { activeActions, appliedRules } = await evaluateContext(ctx);

  let price = basePrice;
  const breakdown = [];

  for (const action of activeActions) {
    const before = price;
    switch (action.type) {
      case 'multiply_price':
        price *= (action.params.factor ?? 1);
        breakdown.push({ op: 'multiply', factor: action.params.factor, rule: action._rule });
        break;
      case 'cap_price':
        if (price > action.params.max) {
          price = action.params.max;
          breakdown.push({ op: 'cap', max: action.params.max, rule: action._rule });
        }
        break;
      case 'floor_price':
        if (price < action.params.min) {
          price = action.params.min;
          breakdown.push({ op: 'floor', min: action.params.min, rule: action._rule });
        }
        break;
      case 'adjust_factor':
        if (ctx[action.params.field] !== undefined) {
          ctx[action.params.field] = action.params.value;
          breakdown.push({ op: 'adjust_factor', field: action.params.field, rule: action._rule });
        }
        break;
      default:
        // emit_event, freeze_dispatch, rollback_policy → manejados fuera del pricing loop
        break;
    }
  }

  return {
    finalPrice:   Math.round(price),
    breakdown,
    appliedRules,
  };
}

// ── CRUD con auditoría ─────────────────────────────────────────────────────

/**
 * createRule(data) — inserta nueva versión de una regla.
 * Nunca modifica la existente (append-only).
 */
async function createRule(data) {
  const parsed = PolicyRuleCreateSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('PolicyRule validation failed: ' + JSON.stringify(parsed.error.flatten()));
  }

  // Deprecar versión anterior si existe y estaba active
  const prev = await PolicyRule.findOne({ ruleId: parsed.data.ruleId, status: 'active' });
  let previousVersionId = null;
  if (prev) {
    previousVersionId = prev._id;
    await PolicyRule.updateOne(
      { _id: prev._id },
      { $set: { status: 'deprecated', deprecatedAt: new Date() } }
    );
    _invalidateCache();
  }

  const rule = new PolicyRule({ ...parsed.data, previousVersionId });
  await rule.save();
  _invalidateCache();
  return rule;
}

/**
 * activateRule(ruleId, version, activatedBy)
 * Mueve shadow → active. Solo una versión activa por ruleId.
 */
async function activateRule(ruleId, version, activatedBy) {
  const input = PolicyActivateSchema.safeParse({ ruleId, version, activatedBy });
  if (!input.success) throw new Error('Activate validation failed');

  // Deprecar activa anterior
  await PolicyRule.updateMany(
    { ruleId, status: 'active' },
    { $set: { status: 'deprecated', deprecatedAt: new Date() } }
  );

  const rule = await PolicyRule.findOneAndUpdate(
    { ruleId, version },
    { $set: { status: 'active', activatedAt: new Date() } },
    { new: true }
  );

  if (!rule) throw new Error(`Regla ${ruleId}@${version} no encontrada`);
  _invalidateCache();
  return rule;
}

/**
 * rollbackRule(ruleId)
 * Revierte a la versión anterior conocida.
 */
async function rollbackRule(ruleId) {
  const current = await PolicyRule.findOne({ ruleId, status: 'active' });
  if (!current) throw new Error(`No hay versión activa de ${ruleId}`);
  if (!current.rollbackable) throw new Error(`Regla ${ruleId} no permite rollback`);
  if (!current.previousVersionId) throw new Error(`Sin versión anterior para ${ruleId}`);

  // Deprecar actual
  await PolicyRule.updateOne(
    { _id: current._id },
    { $set: { status: 'deprecated', deprecatedAt: new Date() } }
  );

  // Reactivar anterior
  const prev = await PolicyRule.findOneAndUpdate(
    { _id: current.previousVersionId },
    { $set: { status: 'active', activatedAt: new Date() } },
    { new: true }
  );

  _invalidateCache();
  return { rolledBackFrom: current.version, restoredTo: prev?.version };
}

/**
 * freezeRule(ruleId) — detiene evaluación sin deprecar
 */
async function freezeRule(ruleId) {
  await PolicyRule.updateMany({ ruleId, status: 'active' }, { $set: { status: 'frozen' } });
  _invalidateCache();
}

/**
 * getRules(filter) — query con filtros
 */
async function getRules(filter = {}) {
  return PolicyRule.find(filter).sort({ priority: 1, createdAt: -1 }).lean();
}

module.exports = {
  evaluateContext,
  applyPricing,
  createRule,
  activateRule,
  rollbackRule,
  freezeRule,
  getRules,
  _invalidateCache,
};
