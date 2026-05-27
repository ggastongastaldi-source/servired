// services/TemporalAssuranceService.js
const TemporalAssuranceState = require('../models/TemporalAssuranceState');
const { ARCHETYPE_POLICIES, getPolicy } = require('../config/archetypeRegistry');

async function initAssurance(pedidoId, clienteId, workerId, rubro, serviceMode, scheduledFor) {
  const policy = getPolicy(rubro, serviceMode);
  const pactState = policy.requiresNightPact ? 'AWAITING_NIGHT_PACT' : 'NOT_REQUIRED';

  const checkpoints = [];
  if (policy.requiresNightPact && scheduledFor) {
    const nightPact = new Date(scheduledFor);
    nightPact.setDate(nightPact.getDate() - 1);
    nightPact.setHours(20, 0, 0, 0);
    checkpoints.push({ type: 'NIGHT_PACT', scheduledAt: nightPact, resolution: 'PENDING' });
  }
  if (policy.requiresTwoHourCheckpoint && scheduledFor) {
    const gate = new Date(new Date(scheduledFor).getTime() - 2 * 60 * 60 * 1000);
    checkpoints.push({ type: 'TWO_HOUR_GATE', scheduledAt: gate, resolution: 'PENDING' });
  }

  const assurance = new TemporalAssuranceState({
    pedidoId, clienteId, workerId,
    archetype: policy.archetype,
    serviceMode, scheduledFor, pactState, checkpoints
  });

  await assurance.save();
  console.log(`[TEMPORAL] Assurance creada | pedido: ${pedidoId} | archetype: ${policy.archetype} | pact: ${pactState}`);
  return assurance;
}

async function processCancellation(pedidoId, cancelledBy, reason = '') {
  const assurance = await TemporalAssuranceState.findOne({ pedidoId });
  if (!assurance) return null;

  const now       = new Date();
  const hoursLeft = assurance.scheduledFor
    ? (assurance.scheduledFor - now) / (1000 * 60 * 60)
    : null;

  let frictionARS  = 0;
  let repDelta     = 0;
  let newPactState = 'BROKEN';

  const policy = ARCHETYPE_POLICIES[assurance.archetype];

  if (assurance.archetype === 'REALTIME_CRITICAL') {
    repDelta = 0;
  } else if (hoursLeft !== null && hoursLeft <= 2) {
    if (cancelledBy === 'CLIENTE') {
      frictionARS  = policy.baseFrictionFeeARS;
      repDelta     = -(policy.reputationPenalty.lateCancel || 35);
      newPactState = 'AUTO_REASSIGNMENT_PENDING';
    } else if (cancelledBy === 'WORKER') {
      repDelta     = -((policy.reputationPenalty.lateCancel || 35) + 10);
      newPactState = 'AUTO_REASSIGNMENT_PENDING';
    }
  } else if (['AWAITING_NIGHT_PACT','NIGHT_PACT_CONFIRMED'].includes(assurance.pactState)) {
    repDelta = -(policy.reputationPenalty.nightCancel || 15);
  }

  Object.assign(assurance, {
    pactState: newPactState,
    cancelledBy, cancelReason: reason,
    frictionApplied: frictionARS > 0,
    frictionAmountARS: frictionARS,
    frictionActor: frictionARS > 0 ? cancelledBy : 'NONE',
    reputationDelta: repDelta,
    resolvedAt: now
  });

  await assurance.save();
  console.log(`[TEMPORAL] Cancelación | pedido: ${pedidoId} | actor: ${cancelledBy} | friction: $${frictionARS} | rep: ${repDelta}`);

  return { assurance, needsReassignment: newPactState === 'AUTO_REASSIGNMENT_PENDING', frictionARS, repDelta };
}

async function confirmNightPact(pedidoId) {
  const assurance = await TemporalAssuranceState.findOne({ pedidoId });
  if (!assurance || assurance.pactState !== 'AWAITING_NIGHT_PACT') return null;

  const cp = assurance.checkpoints.find(c => c.type === 'NIGHT_PACT' && c.resolution === 'PENDING');
  if (cp) { cp.resolution = 'CONFIRMED'; cp.resolvedAt = new Date(); }

  assurance.pactState = 'NIGHT_PACT_CONFIRMED';
  await assurance.save();
  console.log(`[TEMPORAL] Pacto nocturno confirmado | pedido: ${pedidoId}`);
  return assurance;
}

module.exports = { initAssurance, processCancellation, confirmNightPact };
