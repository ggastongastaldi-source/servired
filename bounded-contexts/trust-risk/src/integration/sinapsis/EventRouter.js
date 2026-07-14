'use strict';

/**
 * EventRouter — mapea eventos entrantes de SINAPSIS al Use Case correcto.
 *
 * ADR-001: Trust & Risk nunca llama al Kernel directamente.
 *          Recibe eventos, los procesa, emite eventos de integración.
 *
 * Para agregar soporte a un nuevo evento: agregar entrada en SUPPORTED_EVENTS.
 * No modificar la lógica de routing.
 */

const SUPPORTED_EVENTS = new Set([
  'UserRegistered',
  'LoginSucceeded',
  'LoginFailed',
  'JobCreated',
  'JobAccepted',
  'JobCancelled',
  'PaymentCompleted',
  'ReviewSubmitted',
  'JobCreated',
]);

class EventRouter {

  constructor({ createTrustProfile, processDomainEvent }) {
    this._create  = createTrustProfile;
    this._process = processDomainEvent;
  }

  /**
   * Rutea un evento entrante al use case apropiado.
   * @param {object} event - evento normalizado desde SINAPSIS
   * @returns {Promise<object>} resultado del use case
   */
  async route(event) {
    const actorId = this._extractActorId(event);
    if (!actorId) return { routed: false, reason: 'no_actor_id' };

    if (event.type === 'UserRegistered') {
      return this._handleUserRegistered(event, actorId);
    }

    if (SUPPORTED_EVENTS.has(event.type)) {
      return this._process.execute({ actorId, incomingEvent: event });
    }

    return { routed: false, reason: 'unsupported_event', eventType: event.type };
  }

  async _handleUserRegistered(event, actorId) {
    try {
      const result = await this._create.execute({
        actorId,
        actorType: event.actorType || event.rol || 'CLIENT',
      });
      return { routed: true, action: 'profile_created', ...result };
    } catch (err) {
      if (err.code === 'DUPLICATE_TRUST_PROFILE') {
        // Idempotente: si ya existe, procesar como evento normal
        return this._process.execute({ actorId, incomingEvent: event });
      }
      throw err;
    }
  }

  _extractActorId(event) {
    return event.actorId
      || event.userId
      || event.workerId
      || event.clientId
      || event.merchantId
      || null;
  }
}

module.exports = { EventRouter, SUPPORTED_EVENTS };
