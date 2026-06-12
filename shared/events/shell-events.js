// Capa de emisión de eventos del Shell (menú hamburguesa).
// No define un event_type nuevo: reutiliza SHELL_OPENED / WALLET_OPENED
// del catálogo congelado de Sprint 1, diferenciando la acción concreta
// vía payload.action (ver shell-actions.js).
//
// Todas las funciones son wrappers delgados sobre createEvent() —
// createEvent() sigue siendo la única puerta de entrada al bus.

const { createEvent } = require('./createEvent');
const { EVENT_TYPES } = require('./event-types');
const { SHELL_ACTIONS } = require('./shell-actions');

/**
 * El usuario abrió el menú hamburguesa (Shell).
 * Puede ser un Root Event (primera interacción de la sesión) o un
 * Child Event (si se provee `causation`, p.ej. continúa una cadena
 * iniciada por qr_scanned/landing_viewed).
 *
 * @param {object} params
 * @param {string} [params.correlationId]
 * @param {object} [params.actor] - { user_id, role }
 * @param {object} [params.context] - { tenant_id, session_id, zone, source }
 * @param {object} [params.causation] - { event_id, event_type } del evento padre
 * @param {string} [params.action] - opcionalmente, una SHELL_ACTIONS (ej. OPEN_PROFILE)
 * @returns {object} evento shell_opened válido e inmutable
 */
function emitShellOpened({ correlationId, actor, context, causation, action } = {}) {
  return createEvent({
    type: EVENT_TYPES.SHELL_OPENED,
    actor,
    context,
    correlationId,
    causation,
    payload: { action: action || null }
  });
}

/**
 * El usuario abrió la Wallet desde el Shell.
 * Usa EVENT_TYPES.WALLET_OPENED (existe en el catálogo congelado).
 *
 * @param {object} params - igual forma que emitShellOpened (sin `action`)
 * @returns {object} evento wallet_opened válido e inmutable
 */
function emitWalletOpened({ correlationId, actor, context, causation } = {}) {
  return createEvent({
    type: EVENT_TYPES.WALLET_OPENED,
    actor,
    context,
    correlationId,
    causation,
    payload: { action: SHELL_ACTIONS.OPEN_WALLET }
  });
}

/**
 * El usuario cambió de rol (Cliente <-> Trabajador) desde el Shell.
 * No existe un event_type dedicado: se representa como shell_opened
 * con payload.action = CHANGE_ROLE y el detalle del cambio.
 *
 * @param {object} params
 * @param {string} [params.correlationId]
 * @param {object} [params.actor]
 * @param {object} [params.context]
 * @param {object} [params.causation]
 * @param {string|null} [params.previousRole]
 * @param {string|null} [params.newRole]
 * @returns {object} evento shell_opened (acción change_role) válido e inmutable
 */
function emitRoleChanged({ correlationId, actor, context, causation, previousRole, newRole } = {}) {
  return createEvent({
    type: EVENT_TYPES.SHELL_OPENED,
    actor,
    context,
    correlationId,
    causation,
    payload: {
      action: SHELL_ACTIONS.CHANGE_ROLE,
      previous_role: previousRole != null ? previousRole : null,
      new_role: newRole != null ? newRole : null
    }
  });
}

/**
 * El usuario abrió la sección de Soporte desde el Shell.
 * Se representa como shell_opened con payload.action = OPEN_SUPPORT.
 *
 * @param {object} params - igual forma que emitShellOpened (sin `action`)
 * @returns {object} evento shell_opened (acción open_support) válido e inmutable
 */
function emitSupportOpened({ correlationId, actor, context, causation } = {}) {
  return createEvent({
    type: EVENT_TYPES.SHELL_OPENED,
    actor,
    context,
    correlationId,
    causation,
    payload: { action: SHELL_ACTIONS.OPEN_SUPPORT }
  });
}

module.exports = {
  emitShellOpened,
  emitWalletOpened,
  emitRoleChanged,
  emitSupportOpened
};
