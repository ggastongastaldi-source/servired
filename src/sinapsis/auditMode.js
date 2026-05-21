// SINAPSIS Audit Mode v1.0
// Observa tráfico real sin bloquear — DRY RUN

const { createEvent } = require('./eventSchema');
const { evaluate } = require('./policyEngine');
const { seal } = require('./logManager');
const { normalize, validate } = require('./orderContract');

const AUDIT_MODE = process.env.SINAPSIS_MODE !== 'ENFORCE';

async function auditOrder(rawPedido, source = 'servired') {
  const t0 = Date.now();
  let contract, event, decision;

  try {
    // 1. Normalizar
    contract = normalize(rawPedido);
    validate(contract);

    // 2. Crear evento canónico
    event = createEvent('servired.order.created', {
      total: contract.totalCents / 100,
      totalCents: contract.totalCents,
      currency: contract.currency,
      status: contract.status,
      rubro: contract.rubro,
      zona: contract.zona
    }, { source, node: 'termux', correlationId: contract.id });

    // 3. Evaluar política
    decision = evaluate(event);

    // 4. Sellar log
    await seal(event, decision);

    const result = {
      mode:       AUDIT_MODE ? 'AUDIT' : 'ENFORCE',
      eventId:    event.eventId,
      decision:   decision.decision,
      risk_score: decision.risk_score,
      reason:     decision.reason,
      contract,
      latencyMs:  Date.now() - t0,
      blocked:    false // AUDIT nunca bloquea
    };

    console.log(JSON.stringify({
      level: 'info', source: 'AUDIT_MODE',
      ...result
    }));

    return result;

  } catch (err) {
    console.error(JSON.stringify({
      level: 'error', source: 'AUDIT_MODE',
      error: err.message, latencyMs: Date.now() - t0
    }));

    // AUDIT MODE nunca rompe el flujo principal
    return {
      mode: 'AUDIT', decision: 'ERROR',
      error: err.message, blocked: false,
      latencyMs: Date.now() - t0
    };
  }
}

module.exports = { auditOrder, AUDIT_MODE };
