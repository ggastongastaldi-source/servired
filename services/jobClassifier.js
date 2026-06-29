/**
 * JobClassifier — función pura determinista
 * Input: jobRequest
 * Output: { track: 'DISPATCH' | 'AUCTION', reason, urgency }
 *
 * Regla: DISPATCH para urgentes/commodity, AUCTION para complejos
 * NO tiene side effects. NO toca Mongo. NO emite eventos.
 */
"use strict";

// Rubros que son commodity puro (asignación directa)
const COMMODITY_RUBROS = new Set([
  'limpieza_hogar',
  'servicio_domestico',
  'delivery',
  'mensajeria',
  'mudanza_chica',
  'plomeria_urgente',
  'electricidad_urgente',
  'cerrajeria',
  'gasista_urgente',
]);

// Rubros que requieren presupuesto (auction)
const COMPLEX_RUBROS = new Set([
  'construccion',
  'refaccion',
  'obra_nueva',
  'instalacion_electrica',
  'instalacion_gas',
  'pintura_exterior',
  'arquitectura',
  'diseno_interior',
  'techos',
  'impermeabilizacion',
]);

const URGENCY_LEVELS = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/**
 * @param {Object} jobRequest
 * @param {string} jobRequest.rubro
 * @param {string} [jobRequest.urgency]   - 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
 * @param {number} [jobRequest.estimatedValue] - ARS
 * @param {boolean} [jobRequest.clientWantsQuotes] - override explícito
 * @returns {{ track: string, reason: string, urgency: string }}
 */
function classifyJob(jobRequest) {
  const { rubro, urgency = 'MEDIUM', estimatedValue = 0, clientWantsQuotes = false } = jobRequest;

  // Override explícito del cliente → siempre AUCTION
  if (clientWantsQuotes) {
    return { track: 'AUCTION', reason: 'CLIENT_REQUESTED_QUOTES', urgency };
  }

  const urgencyLevel = URGENCY_LEVELS[urgency] ?? URGENCY_LEVELS.MEDIUM;

  // Urgencia crítica → siempre DISPATCH sin importar rubro
  if (urgencyLevel >= URGENCY_LEVELS.CRITICAL) {
    return { track: 'DISPATCH', reason: 'CRITICAL_URGENCY', urgency };
  }

  // Rubro complejo → AUCTION
  if (COMPLEX_RUBROS.has(rubro)) {
    return { track: 'AUCTION', reason: 'COMPLEX_RUBRO', urgency };
  }

  // Rubro commodity → DISPATCH
  if (COMMODITY_RUBROS.has(rubro)) {
    return { track: 'DISPATCH', reason: 'COMMODITY_RUBRO', urgency };
  }

  // Valor alto sin rubro clasificado → AUCTION
  if (estimatedValue > 50000) {
    return { track: 'AUCTION', reason: 'HIGH_VALUE', urgency };
  }

  // Urgencia alta + rubro desconocido → DISPATCH
  if (urgencyLevel >= URGENCY_LEVELS.HIGH) {
    return { track: 'DISPATCH', reason: 'HIGH_URGENCY_FALLBACK', urgency };
  }

  // Default: AUCTION (más seguro para el cliente)
  return { track: 'AUCTION', reason: 'DEFAULT', urgency };
}

module.exports = { classifyJob, COMMODITY_RUBROS, COMPLEX_RUBROS };
