const { v4: uuidv4 } = require('uuid');
const { validateEvent } = require('./validateEvent');

const DEFAULT_TENANT_ID = 'servired';

/**
 * Única forma autorizada de generar eventos del Bus Nervioso Central.
 *
 * @param {object} params
 * @param {string} params.type - event_type (debe existir en EVENT_TYPES)
 * @param {object} [params.actor] - { user_id, role }
 * @param {object} [params.context] - { tenant_id, session_id, zone, source }
 * @param {object} [params.payload]
 * @param {string} [params.correlationId] - si no se provee, se usa event_id
 * @param {object} [params.causation] - { event_id, event_type } del evento padre
 * @returns {object} evento inmutable y validado
 * @throws {Error} si el evento resultante no pasa validateEvent()
 */
function createEvent({ type, actor, context, payload, correlationId, causation } = {}) {
  const event_id = uuidv4();
  const timestamp = new Date().toISOString();

  const event = {
    event_id,
    event_type: type,
    timestamp,
    correlation_id: correlationId || event_id,
    causation: {
      event_id: causation && causation.event_id != null ? causation.event_id : null,
      event_type: causation && causation.event_type != null ? causation.event_type : null
    },
    actor: {
      user_id: actor && actor.user_id != null ? actor.user_id : null,
      role: actor && actor.role ? actor.role : 'anonymous'
    },
    context: {
      tenant_id: (context && context.tenant_id) || DEFAULT_TENANT_ID,
      session_id: context && context.session_id != null ? context.session_id : null,
      zone: context && context.zone != null ? context.zone : null,
      source: context && context.source != null ? context.source : null
    },
    payload: payload || {},
    metadata: {
      version: 1,
      environment: process.env.NODE_ENV || 'development'
    }
  };

  const { valid, errors } = validateEvent(event);
  if (!valid) {
    throw new Error(`createEvent: evento inválido (type="${type}"): ${errors.join('; ')}`);
  }

  return Object.freeze(event);
}

module.exports = { createEvent };
