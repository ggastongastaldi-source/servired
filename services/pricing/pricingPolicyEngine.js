// pricingPolicyEngine.js — Capa de decisión comercial: PRECIO (v1, acotado)
//
// Consume, en orden:
//   1. MarketFieldEngine.analyze()   — interpretacion ya calculada del ZoneState
//   2. AuctionOutcome (aggregate)    — precio real de mercado, historico reciente
//   3. AladdinInsight (activos)      — señal advisory, solo ajusta confidence,
//                                      NUNCA el precio (respeta ADR-003: Aladdin no decide)
//
// Determinístico: mismo input (misma zona/rubro, mismo estado en Mongo) -> mismo output.
// No usa trust (efímero, ver decisión de julio 2026) ni MerchantProjection (BI, no señal comercial).
// No emite eventos, no escribe nada — solo lee y calcula. Ese es el alcance de v1.

'use strict';

const { analyze: marketFieldAnalyze } = require('../marketField/marketFieldEngine');
const AuctionOutcome = require('../../models/AuctionOutcome');
const AladdinInsight = require('../../models/AladdinInsight');

const HISTORY_WINDOW_DAYS = 30;
const MIN_OUTCOMES_FOR_CONFIDENCE = 1;

// Confianza en la referencia historica: crece con la cantidad de subastas
// resueltas disponibles. Mismo patron que _computeConfidence en incidentCaseAggregator.
function _computeHistoricalConfidence(count) {
  return Math.min(0.3 + count * 0.1, 0.9);
}

// Agregado sobre subastas reales resueltas — precio de mercado observado,
// no el promedio de cotizaciones (que incluye ofertas perdedoras).
async function _getHistoricalStats(zonaId, rubroId) {
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400000);
  const match = { resueltaEn: { $gte: since } };
  if (zonaId) match.zonaId = zonaId;
  if (rubroId) match.rubroId = rubroId;

  const [stats] = await AuctionOutcome.aggregate([
    { $match: match },
    { $group: {
        _id: null,
        avgPrecioGanador: { $avg: '$precioGanador' },
        avgPrecioPromedio: { $avg: '$precioPromedio' },
        minPrecio: { $min: '$precioMinimo' },
        maxPrecio: { $max: '$precioMaximo' },
        avgParticipantes: { $avg: '$totalParticipantes' },
        count: { $sum: 1 }
    }}
  ]);

  if (!stats || stats.count < MIN_OUTCOMES_FOR_CONFIDENCE) return null;

  const spread = stats.avgPrecioPromedio > 0
    ? (stats.maxPrecio - stats.minPrecio) / stats.avgPrecioPromedio
    : 0;

  return {
    basePriceReference: +stats.avgPrecioGanador.toFixed(2),
    spread: +spread.toFixed(3),
    avgParticipantes: +stats.avgParticipantes.toFixed(1),
    sampleSize: stats.count,
    confidence: _computeHistoricalConfidence(stats.count)
  };
}

// Insights activos de Aladdin para la zona/rubro — SOLO lectura, SOLO ajustan
// confidence (nunca el precio). Respeta "insights son advisory, no autoritativos".
async function _getRelevantInsights(zonaId, rubroId) {
  const filter = { status: 'active' };
  if (zonaId) filter.zonaId = zonaId;
  if (rubroId) filter.rubroId = rubroId;

  return AladdinInsight.find(filter)
    .sort({ generatedAt: -1 })
    .limit(5)
    .select('insightType confidence message generatedAt')
    .lean();
}

// Penalización de confianza si Aladdin ya detectó anomalías de precio en la zona/rubro.
// No cambia el precio sugerido — solo baja cuanto podemos confiar en el.
function _applyInsightConfidencePenalty(baseConfidence, insights) {
  const anomaly = insights.find(i => i.insightType === 'PRICE_ANOMALY_LOW');
  if (anomaly) return +(baseConfidence * (1 - anomaly.confidence * 0.3)).toFixed(3);
  return baseConfidence;
}

/**
 * API principal.
 * @returns {{ zoneId, rubroId, suggestedPrice, basePriceReference, multipliers, confidence, sourceInsights, timestamp } | { zoneId, rubroId, suggestedPrice: null, reason, timestamp }}
 */
async function computePricing({ zoneId, rubroId }) {
  if (!zoneId) throw new Error('[PricingPolicyEngine] zoneId requerido');

  const [marketField, historical, insights] = await Promise.all([
    marketFieldAnalyze({ zoneId, rubro: rubroId }),
    _getHistoricalStats(zoneId, rubroId),
    _getRelevantInsights(zoneId, rubroId)
  ]);

  if (!historical) {
    return {
      zoneId, rubroId,
      suggestedPrice: null,
      reason: 'SIN_HISTORIAL_SUFICIENTE',
      marketField: { pricingMultiplier: marketField.pricingMultiplier, zoneState: marketField.zoneState },
      sourceInsights: insights.map(i => i.insightType),
      timestamp: new Date().toISOString()
    };
  }

  const suggestedPrice = +(historical.basePriceReference * marketField.pricingMultiplier).toFixed(2);
  const confidence = _applyInsightConfidencePenalty(historical.confidence, insights);

  return {
    zoneId, rubroId,
    basePriceReference: historical.basePriceReference,
    suggestedPrice,
    multipliers: {
      market: marketField.pricingMultiplier,
      historicalSpread: historical.spread
    },
    confidence,
    sampleSize: historical.sampleSize,
    zoneState: marketField.zoneState,
    sourceInsights: insights.map(i => ({ insightType: i.insightType, confidence: i.confidence })),
    timestamp: new Date().toISOString()
  };
}

module.exports = { computePricing };
