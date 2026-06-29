/**
 * MarketFieldEngine — decisor económico real
 *
 * Lee ZoneState activo desde Mongo y produce:
 * - pricingMultiplier
 * - recommendedWorkers[] (top N por score)
 * - marketPressure
 *
 * NO emite eventos. NO modifica estado. Solo lee y decide.
 * La escritura de estado la hace marketFieldProjection (ya existe).
 */
"use strict";

const ZoneState   = require('../../models/ZoneState');
const workerModel = require('../../models/worker.model');

// Importa ScoringEngine existente — no lo duplicamos
let _scoringEngine = null;
function getScoringEngine() {
  if (!_scoringEngine) {
    try {
      _scoringEngine = require('../../src/dispatch/services/ScoringEngine');
    } catch(e) {
      console.warn('[MarketFieldEngine] ScoringEngine no disponible, usando fallback');
    }
  }
  return _scoringEngine;
}

/**
 * Multiplier de precio basado en presión de mercado
 * marketPressure ∈ [-1, 1]
 * SHORTAGE (>0.2)  → precio sube hasta 1.5x
 * SURPLUS  (<-0.2) → precio baja hasta 0.85x
 * BALANCED         → 1.0x
 */
function computePricingMultiplier(marketPressure, zoneState) {
  if (zoneState === 'SHORTAGE') {
    return +(1 + marketPressure * 0.5).toFixed(3);  // max 1.5x
  }
  if (zoneState === 'SURPLUS') {
    return +(1 + marketPressure * 0.15).toFixed(3); // min 0.85x
  }
  return 1.0;
}

/**
 * Busca workers disponibles en zona y los rankea
 * Devuelve top N workers con su score
 */
async function rankWorkersForJob({ zoneId, rubro, jobLocation, maxWorkers = 5 }) {
  const Usuario = require('../../src/core/models/Usuario');

  const workers = await Usuario.find({
    disponible:     true,
    isOnline:       true,
    especialidades: { $in: [rubro] },
    zona:           zoneId,
  }).select('_id nombre zona ubicacion especialidades').lean();

  if (!workers.length) return [];

  const scoring = getScoringEngine();
  if (!scoring || !scoring.scoreWorker) {
    // fallback: devuelve workers sin score
    return workers.slice(0, maxWorkers).map(w => ({ worker: w, score: 0.5 }));
  }

  const hour = new Date().getHours();
  const scored = workers.map(w => {
    try {
      const result = scoring.scoreWorker({
        worker:      w,
        workerProfile: w,
        jobLocation: jobLocation || { lat: 0, lng: 0 },
        jobZona:     zoneId,
        jobPrice:    0,
        hour,
      });
      return { worker: w, score: result?.finalScore ?? 0.5 };
    } catch(e) {
      return { worker: w, score: 0.5 };
    }
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxWorkers);
}

/**
 * API principal del engine
 * @returns {{ zoneId, marketPressure, zoneState, pricingMultiplier, recommendedWorkers[], timestamp }}
 */
async function analyze({ zoneId, rubro, jobLocation }) {
  if (!zoneId) throw new Error('[MarketFieldEngine] zoneId requerido');

  const zone = await ZoneState.findOne({ zoneId }).lean();

  const pressure   = zone?.marketPressure ?? 0;
  const zoneState  = zone?.zoneState      ?? 'BALANCED';
  const demand     = zone?.demand         ?? 0;
  const supply     = zone?.supply         ?? 0;

  const pricingMultiplier  = computePricingMultiplier(pressure, zoneState);
  const recommendedWorkers = await rankWorkersForJob({ zoneId, rubro, jobLocation });

  return {
    zoneId,
    marketPressure:     pressure,
    zoneState,
    demand,
    supply,
    pricingMultiplier,
    recommendedWorkers,
    timestamp:          new Date().toISOString(),
  };
}

module.exports = { analyze, computePricingMultiplier, rankWorkersForJob };
