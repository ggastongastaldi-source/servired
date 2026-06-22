'use strict';
const { randomUUID } = require('crypto');

/**
 * contextInjector.js — pipeline determinístico de contexto para el asistente.
 *
 * Cada resolver recibe (req, ctx) y devuelve string | null.
 * El resultado se inyecta en req.assistantContext (string único).
 * Emite ASSISTANT_CONTEXT_BUILD al bus SINAPSIS para trazabilidad completa.
 *
 * ctx shape:
 *   { appMode: string|null, userRole: string|null, lastEvent: object|null }
 */

// Importación lazy para no acoplar al boot si SINAPSIS no arrancó aún
let _bus = null;
function getBus() {
  if (_bus) return _bus;
  try {
    _bus = require('../sinapsis/sinapsisBusAdapter');
  } catch {
    _bus = null;
  }
  return _bus;
}

const resolvers = [
  {
    name: 'appMode',
    fn: (req, ctx) => ctx.appMode ? `Modo activo: ${ctx.appMode}.` : null,
  },
  {
    name: 'userRole',
    fn: (req, ctx) => ctx.userRole ? `Rol autenticado: ${ctx.userRole}.` : null,
  },
  {
    name: 'lastEvent',
    fn: (req, ctx) => {
      const ev = ctx.lastEvent;
      if (!ev || typeof ev.event_type !== 'string') return null;
      return `Última acción registrada: ${ev.event_type}.`;
    },
  },
];

module.exports = function contextInjector(req, res, next) {
  const body = req.body || {};

  const ctx = {
    appMode:   typeof body.appMode   === 'string' ? body.appMode   : null,
    userRole:  typeof body.userRole  === 'string' ? body.userRole  : null,
    lastEvent: body.sessionEvents && typeof body.sessionEvents === 'object'
               ? body.sessionEvents
               : null,
  };

  // Ejecutar pipeline — capturar resultado y errores por resolver
  const trace = [];
  const parts = [];

  for (const { name, fn } of resolvers) {
    let value = null;
    let error = null;
    try {
      value = fn(req, ctx);
    } catch (err) {
      error = err.message || String(err);
    }
    trace.push({ name, value, error });
    if (value) parts.push(value);
  }

  req.assistantContext = parts.length ? '\n\n' + parts.join(' ') : '';

  // Emitir evento SINAPSIS — no bloquear si falla
  const correlationId =
    body.correlationId ||
    req.headers['x-correlation-id'] ||
    randomUUID();
  try {
    const bus = getBus();
    if (bus) {
      bus.publish({
        event_type:     'ASSISTANT_CONTEXT_BUILD',
        correlation_id: correlationId,
        payload: {
          ctx,
          trace: process.env.CONTEXT_DEBUG === 'true' ? trace : trace.slice(0, 20),
          trace_count: trace.length,
          context_length: req.assistantContext.length,
          resolvers_active: parts.length,
        },
      }).catch((err) => {
        console.warn('[contextInjector] SINAPSIS publish failed:', err?.message || err);
      }); // fire-and-forget — nunca bloquea el request
    }
  } catch {
    // SINAPSIS caído no rompe el chat
  }

  next();
};
