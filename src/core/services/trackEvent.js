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
  actorId, actorRole = 'sistema', meta = {}
} = {}) {
  // Fire-and-forget — no await en el caller
  registrarEvento({ type, oficio, localidad, slug, actorId, actorRole, meta })
    .catch(e => console.warn('[trackEvent] silenced:', e.message));
}

module.exports = { trackEvent };
