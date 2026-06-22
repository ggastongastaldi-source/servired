'use strict';

/**
 * contextInjector.js — pipeline determinístico de contexto para el asistente.
 *
 * Cada resolver recibe (req, ctx) y devuelve string | null.
 * El resultado se inyecta en req.assistantContext (string único).
 *
 * ctx shape:
 *   { appMode: string|null, userRole: string|null, lastEvent: object|null }
 */

const resolvers = [
  // 1. Modo de app
  (req, ctx) => ctx.appMode ? `Modo activo: ${ctx.appMode}.` : null,

  // 2. Rol autenticado
  (req, ctx) => ctx.userRole ? `Rol autenticado: ${ctx.userRole}.` : null,

  // 3. Último evento de sesión
  (req, ctx) => {
    const ev = ctx.lastEvent;
    if (!ev || typeof ev.event_type !== 'string') return null;
    return `Última acción registrada: ${ev.event_type}.`;
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

  const parts = resolvers
    .map(fn => { try { return fn(req, ctx); } catch { return null; } })
    .filter(Boolean);

  req.assistantContext = parts.length ? '\n\n' + parts.join(' ') : '';
  next();
};
