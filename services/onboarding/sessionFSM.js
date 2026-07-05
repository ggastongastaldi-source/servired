// FSM centralizada para OnboardingSession (convergencia SQOP<->Merchant)
// Ver docs/RFC-onboarding-merchant-fsm.md para el diseño completo.
//
// Unica fuente de verdad de que transiciones son validas. Cualquier
// endpoint que necesite mover el status de una sesion debe pasar por
// aca en lugar de comparar strings sueltos.

const TRANSITIONS = {
  pending:         ['validated', 'expired', 'aborted'],
  validated:       ['authenticated', 'expired', 'aborted'],
  authenticated:   ['profile_created', 'expired', 'aborted'],
  profile_created: ['completed', 'expired', 'aborted'],
  completed:       [],
  expired:         [],
  aborted:         [],
};

class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Transicion invalida: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
    this.statusCode = 409;
    this.from = from;
    this.to = to;
  }
}

function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

// Devuelve una copia (no la referencia interna) de los estados a los
// que se puede transicionar desde 'state'. Util para debug/herramientas
// de admin sin exponer TRANSITIONS de forma mutable.
function allowedTransitions(state) {
  return Array.isArray(TRANSITIONS[state]) ? [...TRANSITIONS[state]] : [];
}

// Aplica la transicion sobre un documento OnboardingSession ya cargado.
// No hace .save() — eso queda a cargo del caller para poder setear otros
// campos (usuarioId, commerceId, completedAt) en el mismo save().
function transition(session, to) {
  const from = session.status;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  session.status = to;
  return session;
}

module.exports = { canTransition, transition, allowedTransitions, InvalidTransitionError };
