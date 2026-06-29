'use strict';
/**
 * NexusTap — puente Nexus → Runtime EventBus
 *
 * Una sola referencia. Se llama al FINAL de emitEvent(),
 * después de que el evento ya fue persistido por el Nexus.
 *
 * Principios:
 * - No bloquea el dominio (fire-and-forget con catch silencioso)
 * - Si el Runtime no está iniciado, no rompe nada
 * - DixieGate ya actuó antes de que emitEvent() fuera llamado
 */

let _bus = null;

function tap(eventType, payload) {
  try {
    if (!_bus) _bus = require('./index').bus;
    // fire-and-forget: el dominio no espera a los servicios del runtime
    _bus.publish({ type: eventType, payload, ts: Date.now() }).catch(err => {
      console.error('[NexusTap] error en bus:', err.message);
    });
  } catch (err) {
    // Runtime no cargado o error: falla silenciosa — el dominio no se ve afectado
    console.error('[NexusTap] no disponible:', err.message);
  }
}

module.exports = { tap };
