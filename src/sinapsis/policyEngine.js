// SINAPSIS Policy Engine v1.0
// Decisiones declarativas sobre eventos

const POLICIES = {
  'servired.order.created': [
    {
      id: 'order_risk_check',
      condition: (event) => event.payload.total > 0,
      decision: 'EXECUTE',
      reason: 'Orden válida con monto positivo'
    },
    {
      id: 'order_zero_amount',
      condition: (event) => event.payload.total <= 0,
      decision: 'REJECT',
      reason: 'Monto inválido'
    }
  ],
  'servired.order.paid': [
    {
      id: 'payment_approved',
      condition: (event) => event.payload.paymentStatus === 'approved',
      decision: 'EXECUTE',
      reason: 'Pago confirmado'
    },
    {
      id: 'payment_pending',
      condition: (event) => event.payload.paymentStatus !== 'approved',
      decision: 'HOLD',
      reason: 'Pago pendiente de confirmación'
    }
  ],
  'grove.stock.updated': [
    {
      id: 'stock_critical',
      condition: (event) => event.payload.available <= 2,
      decision: 'ESCALATE',
      reason: 'Stock crítico — requiere reposición'
    },
    {
      id: 'stock_ok',
      condition: (event) => event.payload.available > 2,
      decision: 'EXECUTE',
      reason: 'Stock suficiente'
    }
  ]
};

function evaluate(event) {
  const t0 = Date.now();
  const policies = POLICIES[event.type] || [];

  for (const policy of policies) {
    try {
      if (policy.condition(event)) {
        const result = {
          policy_id:   policy.id,
          input_event: event.type,
          decision:    policy.decision,
          reason:      [policy.reason],
          risk_score:  policy.decision === 'REJECT' ? 1.0 :
                       policy.decision === 'HOLD'   ? 0.5 :
                       policy.decision === 'ESCALATE' ? 0.7 : 0.1,
          latencyMs:   Date.now() - t0
        };
        console.log(JSON.stringify({ level: 'info', source: 'POLICY_ENGINE', ...result }));
        return result;
      }
    } catch (err) {
      console.error(`[POLICY_ENGINE] Error en policy ${policy.id}:`, err.message);
    }
  }

  // Default — sin política definida
  return {
    policy_id:   'default_passthrough',
    input_event: event.type,
    decision:    'EXECUTE',
    reason:      ['Sin política específica — passthrough'],
    risk_score:  0.2,
    latencyMs:   Date.now() - t0
  };
}

module.exports = { evaluate, POLICIES };
