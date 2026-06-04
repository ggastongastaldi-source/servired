// JobEconomicsEngine — dimension economica del dispatch
// Muchos workers aceptan viajes largos si el ingreso lo justifica

// Costo estimado de traslado por km (ARS, actualizable via config)
const COST_PER_KM_ARS = parseFloat(process.env.COST_PER_KM_ARS || '150');

// Tiempo minimo rentable: si el job paga menos que 30min de trabajo -> bajo score
const MIN_PROFITABLE_PRICE_ARS = parseFloat(process.env.MIN_PROFITABLE_PRICE_ARS || '3000');

// Calcular profitabilityScore ∈ [0,1]
function calculateProfitability({ distanceKm, etaMinutes, jobPrice }) {
  if (!jobPrice || jobPrice <= 0) return 0;

  // Costo estimado de traslado (ida)
  const travelCost = distanceKm * COST_PER_KM_ARS;

  // Ganancia neta estimada
  const netProfit = jobPrice - travelCost;

  // Score base: ratio ganancia/precio
  const profitRatio = netProfit / jobPrice;

  // Penalizar trabajos que no cubren el traslado
  if (netProfit <= 0) return 0;

  // Score normalizado 0-1
  const score = Math.min(1, Math.max(0, profitRatio));

  return Math.round(score * 100) / 100;
}

module.exports = { calculateProfitability };
