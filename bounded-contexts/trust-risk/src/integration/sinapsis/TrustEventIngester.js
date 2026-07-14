'use strict';

/**
 * TrustEventIngester — punto de entrada de eventos desde SINAPSIS.
 *
 * Responsabilidades:
 * - Recibir eventos del bus SINAPSIS
 * - Normalizar el formato
 * - Delegar al EventRouter
 * - Registrar errores sin romper el flujo (fail-safe)
 *
 * ADR-001: desacoplamiento total — este módulo es infraestructura,
 *          no dominio. El dominio no sabe que SINAPSIS existe.
 */
class TrustEventIngester {

  constructor({ eventRouter, logger }) {
    this._router = eventRouter;
    this._logger = logger || console;
  }

  /**
   * Procesa un evento entrante desde SINAPSIS.
   * Diseñado para ser registrado como handler en el bus Nexus/SINAPSIS.
   *
   * @param {object} rawEvent - evento raw del bus
   */
  async ingest(rawEvent) {
    let event;
    try {
      event = this._normalize(rawEvent);
    } catch (err) {
      this._logger.error('[TrustRisk] Error normalizando evento:', err.message, rawEvent);
      return { ingested: false, reason: 'normalization_error' };
    }

    try {
      const result = await this._router.route(event);
      if (result.routed === false) {
        this._logger.debug('[TrustRisk] Evento ignorado:', event.type, result.reason);
      }
      return { ingested: true, ...result };
    } catch (err) {
      this._logger.error('[TrustRisk] Error procesando evento:', event.type, err.message);
      // No relanzar — el bus no debe crashear por errores del BC
      return { ingested: false, reason: 'processing_error', error: err.message };
    }
  }

  /**
   * Normaliza distintos formatos de eventos del Kernel al contrato interno.
   */
  _normalize(raw) {
    if (!raw || !raw.type) throw new Error('Event must have a type');

    return {
      type:       raw.type,
      id:         raw.id || raw.eventId || raw._id?.toString() || null,
      actorId:    raw.actorId || raw.userId || raw.workerId || raw.clientId || raw.merchantId || null,
      actorType:  raw.actorType || raw.rol   || null,
      jobId:      raw.jobId    || raw.pedidoId || null,
      paymentId:  raw.paymentId || null,
      occurredAt: raw.occurredAt || raw.createdAt || new Date().toISOString(),
      _raw:       raw,
    };
  }

  /**
   * Registra el ingester en el bus SINAPSIS/Nexus del Kernel.
   * Llamar desde el bootstrap del servidor.
   *
   * @param {object} nexusBus - instancia del EventBus del Kernel
   */
  registerOnNexus(nexusBus) {
    const EVENTS_TO_SUBSCRIBE = [
      'UserRegistered', 'LoginSucceeded', 'LoginFailed',
      'JobCreated', 'JobAccepted', 'JobCancelled',
      'PaymentCompleted', 'ReviewSubmitted',
    ];

    for (const eventType of EVENTS_TO_SUBSCRIBE) {
      nexusBus.on(eventType, async (event) => {
        await this.ingest({ ...event, type: eventType });
      });
    }

    this._logger.info('[TrustRisk] TrustEventIngester registrado en Nexus bus');
  }
}

module.exports = { TrustEventIngester };
