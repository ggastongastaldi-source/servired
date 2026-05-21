// SINAPSIS DixieGate v1.0
// Ingesta, evaluación y ejecución controlada de eventos

const { createEvent, validateEvent } = require('./eventSchema');
const { evaluate } = require('./policyEngine');
const { seal } = require('./logManager');

async function ingest(type, payload = {}, metadata = {}, executor = null) {
  const t0 = Date.now();

  // 1. Crear evento SINAPSIS
  const event = createEvent(type, payload, metadata);

  // 2. Validar contrato
  validateEvent(event);

  // 3. Evaluar política
  const decision = evaluate(event);

  // 4. Sellar en LogManager (memoria inmutable)
  await seal(event, decision);

  // 5. Ejecutar si corresponde
  let executionResult = null;
  if (decision.decision === 'EXECUTE' && executor) {
    try {
      executionResult = await executor(event, decision);
      console.log(JSON.stringify({
        level: 'info', source: 'DIXIE_GATE',
        eventId: event.eventId, type, decision: 'EXECUTED',
        latencyMs: Date.now() - t0
      }));
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error', source: 'DIXIE_GATE',
        eventId: event.eventId, type, error: err.message,
        latencyMs: Date.now() - t0
      }));
      decision.decision = 'FAILED';
    }
  } else if (decision.decision === 'HOLD') {
    console.log(JSON.stringify({
      level: 'warn', source: 'DIXIE_GATE',
      eventId: event.eventId, type, decision: 'HELD',
      reason: decision.reason
    }));
  } else if (decision.decision === 'ESCALATE') {
    console.warn(JSON.stringify({
      level: 'warn', source: 'DIXIE_GATE',
      eventId: event.eventId, type, decision: 'ESCALATED',
      risk_score: decision.risk_score, reason: decision.reason
    }));
  } else if (decision.decision === 'REJECT') {
    console.error(JSON.stringify({
      level: 'error', source: 'DIXIE_GATE',
      eventId: event.eventId, type, decision: 'REJECTED',
      reason: decision.reason
    }));
  }

  return { event, decision, executionResult, latencyMs: Date.now() - t0 };
}

module.exports = { ingest };
