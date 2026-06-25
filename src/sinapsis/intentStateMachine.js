/**
 * Intent State Machine — ServiRed OS Sprint 3
 * ADR-006: función pura, sin estado interno, sin IO
 * transition(currentState, event) → { nextState, emittedEvents, error }
 */

const STATES = {
  CREATED:         'CREATED',
  CLASSIFIED:      'CLASSIFIED',
  VALIDATED:       'VALIDATED',
  POLICY_PENDING:  'POLICY_PENDING',
  POLICY_APPROVED: 'POLICY_APPROVED',
  POLICY_REJECTED: 'POLICY_REJECTED',
  MATCHING:        'MATCHING',
  RESERVED:        'RESERVED',
  COMPLETED:       'COMPLETED',
  CANCELLED:       'CANCELLED',
  EXPIRED:         'EXPIRED'
};

const TERMINAL_STATES = new Set([
  STATES.COMPLETED, STATES.CANCELLED,
  STATES.EXPIRED,   STATES.POLICY_REJECTED
]);

const EVENTS = {
  INTENT_RECEIVED:         'INTENT_RECEIVED',
  INTENT_CLASSIFIED:       'INTENT_CLASSIFIED',
  INTENT_VALIDATED:        'INTENT_VALIDATED',
  INTENT_POLICY_EVALUATED: 'INTENT_POLICY_EVALUATED',
  INTENT_MATCHED:          'INTENT_MATCHED',
  INTENT_RESERVED:         'INTENT_RESERVED',
  INTENT_COMPLETED:        'INTENT_COMPLETED',
  INTENT_CANCELLED:        'INTENT_CANCELLED',
  INTENT_EXPIRED:          'INTENT_EXPIRED'
};

// guard: retorna string de error o null si OK
const TRANSITIONS = {
  [STATES.CREATED]: {
    [EVENTS.INTENT_CLASSIFIED]: {
      nextState: STATES.CLASSIFIED,
      guard: (e) => {
        if (!e.payload?.intentId) return 'intentId requerido';
        if (!e.payload?.rubros && !e.payload?.obras) return 'rubros u obras requeridos';
        return null;
      }
    },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED }
  },
  [STATES.CLASSIFIED]: {
    [EVENTS.INTENT_VALIDATED]: {
      nextState: STATES.VALIDATED,
      guard: (e) => e.payload?.intentId ? null : 'intentId requerido'
    },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED }
  },
  [STATES.VALIDATED]: {
    [EVENTS.INTENT_POLICY_EVALUATED]: {
      nextState: STATES.POLICY_PENDING,
      guard: (e) => e.payload?.policyId ? null : 'policyId requerido'
    },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED }
  },
  [STATES.POLICY_PENDING]: {
    [EVENTS.INTENT_POLICY_EVALUATED]: {
      nextState: null,
      guard: (e) => {
        const valid = ['EXECUTE', 'REJECT', 'HOLD'];
        return valid.includes(e.payload?.decision)
          ? null
          : `decision debe ser: ${valid.join(', ')}`;
      },
      resolveNext: (e) =>
        e.payload.decision === 'EXECUTE' ? STATES.POLICY_APPROVED :
        e.payload.decision === 'REJECT'  ? STATES.POLICY_REJECTED :
        STATES.POLICY_PENDING
    },
    [EVENTS.INTENT_EXPIRED]:   { nextState: STATES.EXPIRED },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED }
  },
  [STATES.POLICY_APPROVED]: {
    [EVENTS.INTENT_MATCHED]: {
      nextState: STATES.MATCHING,
      guard: (e) =>
        (e.payload?.workerId || e.payload?.commerceId)
          ? null : 'workerId o commerceId requerido'
    },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED },
    [EVENTS.INTENT_EXPIRED]:   { nextState: STATES.EXPIRED }
  },
  [STATES.MATCHING]: {
    [EVENTS.INTENT_RESERVED]:  { nextState: STATES.RESERVED },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED },
    [EVENTS.INTENT_EXPIRED]:   { nextState: STATES.EXPIRED }
  },
  [STATES.RESERVED]: {
    [EVENTS.INTENT_COMPLETED]: { nextState: STATES.COMPLETED },
    [EVENTS.INTENT_CANCELLED]: { nextState: STATES.CANCELLED },
    [EVENTS.INTENT_EXPIRED]:   { nextState: STATES.EXPIRED }
  }
};

function transition(currentState, event) {
  if (TERMINAL_STATES.has(currentState)) {
    return { nextState: currentState, emittedEvents: [], error: `Estado terminal ${currentState} no acepta transiciones` };
  }
  if (!TRANSITIONS[currentState]) {
    return { nextState: currentState, emittedEvents: [], error: `Estado desconocido: ${currentState}` };
  }
  const tx = TRANSITIONS[currentState][event.type];
  if (!tx) {
    return { nextState: currentState, emittedEvents: [], error: `Transición inválida: ${currentState} + ${event.type}` };
  }
  if (tx.guard) {
    const err = tx.guard(event);
    if (err) return { nextState: currentState, emittedEvents: [], error: `Guard: ${err}` };
  }
  const nextState = tx.resolveNext ? tx.resolveNext(event) : tx.nextState;
  return {
    nextState,
    emittedEvents: [{
      type:    'INTENT_TRANSITION',
      actorId: event.payload?.actorId || null,
      zoneId:  event.payload?.zoneId  || null,
      payload: {
        intentId:     event.payload?.intentId || null,
        fromState:    currentState,
        toState:      nextState,
        triggerEvent: event.type,
        trustContext: event.payload?.trustContext || null, // ADR-006: hook Trust Engine
        ...event.payload
      }
    }],
    error: null
  };
}

function isTerminal(state) { return TERMINAL_STATES.has(state); }
function getValidTransitions(state) {
  if (TERMINAL_STATES.has(state)) return [];
  return Object.keys(TRANSITIONS[state] || {});
}

module.exports = { transition, isTerminal, getValidTransitions, STATES, EVENTS };
