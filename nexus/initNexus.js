// Nexus Runtime Manager — ciclo de vida encapsulado
// Single-flight por proceso. Sin contaminacion global.
const state = {
  initialized: false,
  timeoutId:   null,
  intervalId:  null
};

async function initNexus(io) {
  // Single-flight guard — per-process (suficiente para Render free tier)
  if (state.initialized) {
    console.warn('[Nexus] initNexus ya fue llamado en este proceso — ignorando');
    return;
  }
  state.initialized = true;

  const { ensureEventStore } = require('./bootstrap/ensureEventStore');
  const { iniciarObserver }  = require('./reactive/changeStreamObserver');
  const { runActuator }      = require('./shadow/shadowPricingActuator');

  // Lifecycle: beforeInit
  console.log('[Nexus] 🚀 Iniciando runtime...');

  // Bootstrap secuencial — falla fuerte si EventStore no levanta
  await ensureEventStore();
  await iniciarObserver(io);

  console.log('[Nexus] ✅ Ecosistema reactivo OK');

  // Shadow actuator — primer run a los 8s, luego cada 60s
  state.timeoutId  = setTimeout(() => { runActuator().catch(()=>{}); }, 8000);
  state.intervalId = setInterval(() => { runActuator().catch(()=>{}); }, 60000);

  // Lifecycle: afterInit — shutdown handler
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

function shutdown(signal) {
  console.log(`[Nexus] 🛑 Shutdown (${signal}) — limpiando timers`);
  if (state.timeoutId)  clearTimeout(state.timeoutId);
  if (state.intervalId) clearInterval(state.intervalId);
  state.initialized = false;
}

module.exports = { initNexus, shutdown, state };
