// Catálogo congelado de acciones del Shell (menú hamburguesa).
// Estas acciones viven en payload.action, NO en event_type.
// El event_type sigue restringido al catálogo de EVENT_TYPES (Sprint 1, congelado).

const SHELL_ACTIONS = Object.freeze({
  OPEN_WALLET: 'open_wallet',
  OPEN_SUPPORT: 'open_support',
  CHANGE_ROLE: 'change_role',
  OPEN_PROFILE: 'open_profile'
});

module.exports = { SHELL_ACTIONS };
