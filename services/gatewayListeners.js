/**
 * B19 Gateway — Event Listeners
 * Conectar aquí efectos secundarios sin tocar el gateway core.
 */
'use strict';

const gateway = require('./controlPlaneGateway');

gateway.on('freeze_dispatch', ({ ctx, reason }) => {
  console.warn(`[B19] FREEZE_DISPATCH zona=${ctx.zona} reason=${reason} pedido=${ctx.pedidoId}`);
});

gateway.on('global_freeze_activated', () => {
  console.error('[B19] ⚠ GLOBAL FREEZE ACTIVADO — dispatch suspendido');
});

gateway.on('global_freeze_lifted', () => {
  console.log('[B19] ✓ Global freeze levantado — dispatch restaurado');
});

gateway.on('gateway_error', ({ phase, err, ctx }) => {
  console.error(`[B19] ERROR en ${phase}: ${err} pedido=${ctx?.pedidoId}`);
});

gateway.on('shadow_decision', ({ decision, ctx }) => {
  if (decision.pricing) {
    console.log(`[B19 SHADOW] precio=${decision.pricing.finalPrice} rules=${decision.appliedRules.length} pedido=${ctx.pedidoId}`);
  }
});

module.exports = gateway; // re-export para que server.js solo haga require('./services/gatewayListeners')
