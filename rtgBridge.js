// rtgBridge.js — conecta ServiRed operacional con RTG/DixieGate
// Instancia única compartida (singleton)
'use strict';

let _adapter = null;
let _loop    = null;
let _bus     = null;

function init() {
  try {
    // RTG compila a dist/
    const { MessageBus }       = require('./src/rtg/dist/MessageBus');
    const { ControlLoop }      = require('./src/rtg/dist/ControlLoop');
    const { AnalyticsService } = require('./src/rtg/dist/AnalyticsService');
    const { ServiRedAdapter }  = require('./src/rtg/dist/shadow/ServiRedAdapter');

    _bus     = new MessageBus();
    _loop    = new ControlLoop(_bus);
    _adapter = new ServiRedAdapter();
    new AnalyticsService(_bus); // suscribe al bus

    console.log('[RTG] ✅ DixieGate bridge activo');
  } catch(e) {
    console.warn('[RTG] Bridge no disponible (RTG no compilado):', e.message);
  }
}

// Observa un evento ServiRed y retorna la decisión del DixieGate
// Si RTG no está disponible, retorna ALLOW por defecto (fail-open)
function observe(eventName, payload = {}, J_after = null) {
  if (!_adapter || !_loop) return { decision: 'ALLOW', regime: 'INITIALIZING' };
  try {
    const event  = _adapter.adapt(eventName, payload);
    const jAfter = J_after ?? event.J * 0.95;
    return _loop.process(event, jAfter);
  } catch(e) {
    console.error('[RTG] observe error:', e.message);
    return { decision: 'ALLOW', regime: 'INITIALIZING' };
  }
}

function snapshot() {
  if (!_adapter) return null;
  return _adapter.pressureSnapshot();
}

module.exports = { init, observe, snapshot };
