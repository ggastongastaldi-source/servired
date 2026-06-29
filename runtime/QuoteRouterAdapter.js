'use strict';

/**
 * QuoteRouterAdapter
 *
 * Adaptador que implementa la interfaz { publish(event) } que espera quoteService.
 * Traduce el formato canónico Quote (event_type, event_id) al formato del Runtime (type).
 * Publica al Runtime EventBus via NexusTap.
 *
 * No toca el schema. No toca quoteService. No toca Nexus.
 * Solo traduce y propaga.
 */

const { tap } = require('./NexusTap');

const QuoteRouterAdapter = {
  publish(event) {
    if (!event || !event.event_type) {
      return Promise.resolve();
    }
    // Traducir event_type → type para el Runtime EventBus
    tap(event.event_type, {
      ...event.payload,
      // Preservar metadata útil para el Observer
      _eventId:       event.event_id,
      _correlationId: event.correlation_id,
      _actor:         event.actor,
      _ts:            event.timestamp,
    });
    return Promise.resolve();
  }
};

module.exports = QuoteRouterAdapter;
