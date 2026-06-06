// DixieObserver — Fase 0 OBSERVE_ONLY
// Contrato: observe() → registra → ALLOW → nunca bloquea

const OBSERVED_EVENTS = [
  'aceptar_trabajo',
  'cambiar_estado_pedido',
  'nuevo_pedido',
  'trabajo_completado',
  'cancelar_pedido'
];

function observe(event, payload, socket) {
  if (!OBSERVED_EVENTS.includes(event)) return { decision: 'ALLOW', reason: 'OBSERVE_ONLY' };

  const aggregateId = payload?.pedidoId
    || payload?.trabajadorId
    || payload?.servicio?.id
    || null;

  console.warn('[DixieGate:observe]', JSON.stringify({
    level:       'observe',
    source:      'DIXIE_GATE_PHASE0',
    timestamp:   new Date().toISOString(),
    socketId:    socket.id,
    userId:      socket.data?.userId || 'anon',
    event,
    aggregateId,
    decision:    'ALLOW',
    reason:      'OBSERVE_ONLY'
  }));

  return { decision: 'ALLOW', reason: 'OBSERVE_ONLY' };
}

module.exports = { observe, OBSERVED_EVENTS };
