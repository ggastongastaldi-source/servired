/**
 * CommissionEngine — Motor económico central de ServiRed.
 * Regla cardinal: ningún controlador, handler ni socket
 * calcula porcentajes. Todo pasa por aquí.
 */
const CommissionPolicy = require('../models/CommissionPolicy');

let _policyCache   = null;
let _cacheExpireAt = 0;
const CACHE_TTL_MS = 60_000;

async function _loadActivePolicy() {
  const now = Date.now();
  if (_policyCache && now < _cacheExpireAt) return _policyCache;
  const policy = await CommissionPolicy.findOne({ active: true }).lean();
  if (!policy) throw new Error('[CommissionEngine] No hay política activa en BD.');
  _policyCache   = policy;
  _cacheExpireAt = now + CACHE_TTL_MS;
  return policy;
}

function invalidateCache() {
  _policyCache   = null;
  _cacheExpireAt = 0;
}

async function calculate(job) {
  const {
    grossAmount,
    rubro          = null,
    zone           = null,
    clientType     = 'individual',
    workerType     = 'standard',
    promotionCodes = [],
    jobId          = null,
    date           = new Date(),
  } = job;

  if (typeof grossAmount !== 'number' || grossAmount <= 0)
    throw new Error('[CommissionEngine] grossAmount inválido: ' + grossAmount);

  const policy      = await _loadActivePolicy();
  const explanation = [];

  explanation.push('Política activa: v' + policy.policyVersion);
  explanation.push('Monto bruto: $' + grossAmount.toFixed(2));

  // 1. Tier
  const tiers = [...policy.tiers].sort((a, b) => (a.maxAmount ?? Infinity) - (b.maxAmount ?? Infinity));
  let selectedTier = tiers[tiers.length - 1];
  for (const tier of tiers) {
    const cap = tier.maxAmount === null ? Infinity : tier.maxAmount;
    if (grossAmount <= cap) { selectedTier = tier; break; }
  }
  let effectiveRate = selectedTier.rate;
  explanation.push('Tier: "' + selectedTier.label + '" | base: ' + (effectiveRate * 100).toFixed(2) + '%');

  // 2. Override rubro
  if (rubro && policy.rubroOverrides && policy.rubroOverrides[rubro] !== undefined) {
    effectiveRate = policy.rubroOverrides[rubro];
    explanation.push('Override rubro "' + rubro + '": ' + (effectiveRate * 100).toFixed(2) + '%');
  }

  // 3. Override zona
  if (zone && policy.zoneOverrides && policy.zoneOverrides[zone] !== undefined) {
    effectiveRate = policy.zoneOverrides[zone];
    explanation.push('Override zona "' + zone + '": ' + (effectiveRate * 100).toFixed(2) + '%');
  }

  // 4. Promociones
  let bestDiscount = 0;
  let appliedPromo = null;
  for (const promo of (policy.promotions || [])) {
    if (promotionCodes.includes(promo.code) && new Date(promo.validUntil) >= date) {
      if (promo.discountRate > bestDiscount) {
        bestDiscount = promo.discountRate;
        appliedPromo = promo.code;
      }
    }
  }
  if (appliedPromo) {
    effectiveRate = Math.max(0, effectiveRate - bestDiscount);
    explanation.push('Promo "' + appliedPromo + '": -' + (bestDiscount * 100).toFixed(2) + '% → tasa: ' + (effectiveRate * 100).toFixed(2) + '%');
  }

  // 5. Montos
  const commissionAmount = parseFloat((grossAmount * effectiveRate).toFixed(2));
  const workerAmount     = parseFloat((grossAmount - commissionAmount).toFixed(2));

  explanation.push('Comisión ServiRed: $' + commissionAmount.toFixed(2));
  explanation.push('Pago trabajador: $' + workerAmount.toFixed(2));

  return {
    policyVersion: policy.policyVersion,
    grossAmount,
    baseRate:         selectedTier.rate,
    effectiveRate,
    commissionAmount,
    workerAmount,
    tierLabel:        selectedTier.label,
    explanation,
    meta: { jobId, rubro, zone, clientType, workerType, appliedPromo, timestamp: date.toISOString() },
  };
}

module.exports = { calculate, invalidateCache };
