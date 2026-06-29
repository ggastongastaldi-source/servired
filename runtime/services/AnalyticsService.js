'use strict';

/**
 * ServiRed OS — AnalyticsService
 * Observa eventos de dominio → persiste en marketing_events.
 * Usa el schema real de MarketingEvent: type, actorId, actorRole, meta.
 * Insert-only. Nunca muta dominio.
 */

const DOMAIN_TO_MARKETING = {
  QUOTE_SENT:   { type: 'contratacion_realizada', role: 'trabajador', actorField: 'workerId' },
  QUOTE_SELECTED:    { type: 'contratacion_realizada', role: 'cliente',    actorField: 'clientId' },
  WORKER_ACTIVATED:  { type: 'profesional_aprobado',   role: 'trabajador', actorField: 'workerId' },
  SERVICE_COMPLETED: { type: 'contratacion_realizada', role: 'sistema',    actorField: null       },
  PAYMENT_COLLECTED: { type: 'contratacion_realizada', role: 'sistema',    actorField: null       },
};

class AnalyticsService {
  constructor() {
    this.name   = 'AnalyticsService';
    this._unsub = null;
  }

  async start(bus) {
    const types = Object.keys(DOMAIN_TO_MARKETING);
    this._unsub = bus.on(types, event => this._record(event));
  }

  async stop() {
    if (this._unsub) this._unsub();
  }

  async _record(event) {
    try {
      const mapping = DOMAIN_TO_MARKETING[event.type];
      if (!mapping) return;
      const { registrarEvento } = require('../../src/core/marketing/MarketingEvent');
      const p = event.payload || {};
      await registrarEvento({
        type:      mapping.type,
        actorId:   mapping.actorField ? p[mapping.actorField] : undefined,
        actorRole: mapping.role,
        meta:      { domainEvent: event.type, ...p },
      });
    } catch (err) {
      // Analytics nunca rompe el flujo principal
      console.error('[Analytics] error:', err.message);
    }
  }
}

module.exports = AnalyticsService;
