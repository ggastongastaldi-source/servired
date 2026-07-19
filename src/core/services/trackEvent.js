'use strict';
/**
 * trackEvent — capa de instrumentación desacoplada.
 * Fire-and-forget: nunca rompe el flujo principal.
 * 
 * Uso:
 *   const { trackEvent } = require('../services/trackEvent');
 *   trackEvent('boost_viewed', { commerceId, actorId });
 */
const { registrarEvento } = require('../marketing/MarketingEvent');

async function trackEvent(type, {
  oficio, localidad, slug,
  actorId, actorRole = 'sistema', meta = {},
  // Campos territoriales y temporales (seoEventEnricher)
  economicCorridor, municipality, neighborhood, province,
  region, priorityTier, economicNodeId,
  sessionId, weekOfYear, dayOfWeek, hourBucket, year, month, intentType,
} = {}) {
  // Fire-and-forget — no await en el caller
  registrarEvento({
    type, oficio, localidad, slug, actorId, actorRole, meta,
    economicCorridor, municipality, neighborhood, province,
    region, priorityTier, economicNodeId,
    sessionId, weekOfYear, dayOfWeek, hourBucket, year, month, intentType,
  }).catch(e => console.warn('[trackEvent] silenced:', e.message));
}

module.exports = { trackEvent };
