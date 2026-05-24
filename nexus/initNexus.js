// Nexus Runtime Manager — Sidecar Resiliente
// Decisión arquitectónica: Nexus NO es kernel dependency.
// Si Nexus falla, ServiRed sigue operando normalmente.
// El server NUNCA espera a Nexus para levantar.

const state = {
  initialized: false,
  timeoutId:   null,
  intervalId:  null
};

async function initNexus(io) {
  if (state.initialized) {
    console.warn('[Nexus] Ya inicializado en este proceso — ignorando');
    return { status: 'already_initialized' };
  }
  state.initialized = true;

  const { ensureEventStore } = require('./bootstrap/ensureEventStore');
  const { init: initDispatcher } = require('./infrastructure/outboxDispatcher');
  const { startPulse } = require('./application/governanceLayer');
  const { iniciarObserver }  = require('./reactive/changeStreamObserver');
  const { runActuator }      = require('./shadow/shadowPricingActuator');

  console.log('[Nexus] 🚀 Iniciando runtime (sidecar)...');

  await ensureEventStore();
  await iniciarObserver(io);

  initDispatcher(io);
  startPulse(io);
  console.log('[Nexus] ✅ Ecosistema reactivo OK');

  // Timers en state local — nunca global
  state.timeoutId  = setTimeout(() => { runActuator().catch(()=>{}); }, 8000);
  state.intervalId = setInterval(() => { runActuator().catch(()=>{}); }, 60000);

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));

  return { status: 'ok' };
}

function shutdown(signal) {
  console.log(`[Nexus] 🛑 Shutdown (${signal})`);
  if (state.timeoutId)  { clearTimeout(state.timeoutId);   state.timeoutId  = null; }
  if (state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
  state.initialized = false;
}

module.exports = { initNexus, shutdown, state };
