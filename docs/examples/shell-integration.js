// Ejemplo de integración del Shell con el Bus Nervioso Central.
//
// Muestra el patrón de propagación causal:
//   1. Recuperar (o crear) el correlation_id activo de la sesión.
//   2. Emitir shell_opened (puede ser Root Event si es la primera
//      interacción de la sesión, o Child Event si continúa una
//      cadena previa, ej. iniciada por qr_scanned).
//   3. Emitir wallet_opened como hijo causal de shell_opened,
//      manteniendo el MISMO correlation_id.
//
// NOTA SOBRE EL FRONTEND REAL:
// En el navegador, el "store de sesión" de abajo es sessionStorage,
// con el mismo patrón ya usado en public/js/qr-landing.js para
// origin_ref:
//
//   sessionStorage.getItem('correlation_id')
//   sessionStorage.setItem('correlation_id', evt.correlation_id)
//   sessionStorage.setItem('last_event', JSON.stringify({
//     event_id: evt.event_id,
//     event_type: evt.event_type
//   }))
//
// Este archivo simula ese store con un objeto en memoria para que
// el ejemplo sea ejecutable con `node docs/examples/shell-integration.js`.

const { emitShellOpened, emitWalletOpened } = require('../../shared/events/shell-events');

// --- Simulación de sessionStorage (browser real: usar sessionStorage) ---
const sessionStore = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = value; }
};

function getActiveCorrelationId() {
  return sessionStore.getItem('correlation_id');
}

function getLastEventRef() {
  const raw = sessionStore.getItem('last_event');
  return raw ? JSON.parse(raw) : null;
}

function persistEventRef(evt) {
  sessionStore.setItem('correlation_id', evt.correlation_id);
  sessionStore.setItem('last_event', JSON.stringify({
    event_id: evt.event_id,
    event_type: evt.event_type
  }));
}

// --- Contexto de ejemplo (en el frontend real vendría del estado de la app) ---
const actor = { user_id: 'usr_123', role: 'CLIENTE' };
const context = {
  tenant_id: 'servired',
  session_id: 'sess_abc123',
  zona: undefined, // ejemplo: no usar claves fuera del contrato
  zone: 'la_matanza',
  source: 'shell'
};

// 1. Recuperar correlation_id activo (si esta sesión ya venía de qr_scanned, etc.)
const existingCorrelationId = getActiveCorrelationId();
const existingCausationRef = getLastEventRef();

// 2. Emitir shell_opened
//    - Si NO había correlation_id previo: este evento es Root
//      (correlationId=undefined -> createEvent usa su propio event_id).
//    - Si SÍ había: este evento es Child de la cadena existente.
const shellEvt = emitShellOpened({
  correlationId: existingCorrelationId || undefined,
  actor,
  context,
  causation: existingCausationRef || undefined,
  action: null
});

persistEventRef(shellEvt);

console.log('shell_opened ->', {
  event_id: shellEvt.event_id,
  correlation_id: shellEvt.correlation_id,
  causation: shellEvt.causation
});

// 3. Emitir wallet_opened como hijo causal de shell_opened,
//    manteniendo el mismo correlation_id.
const walletEvt = emitWalletOpened({
  correlationId: getActiveCorrelationId(),
  actor,
  context,
  causation: getLastEventRef()
});

persistEventRef(walletEvt);

console.log('wallet_opened ->', {
  event_id: walletEvt.event_id,
  correlation_id: walletEvt.correlation_id,
  causation: walletEvt.causation
});

// --- Verificación de la cadena causal ---
console.log('\nCadena causal preservada:', {
  mismo_correlation_id: shellEvt.correlation_id === walletEvt.correlation_id,
  wallet_causa_es_shell: walletEvt.causation.event_id === shellEvt.event_id
});
