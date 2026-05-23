// Dixie Gate v1.0 — Audit Layer
// DIXIE_MODE=observe: nunca bloquea, solo registra
const crypto   = require('crypto');
const mongoose = require('mongoose');

const DIXIE_MODE         = process.env.DIXIE_MODE || 'observe';
const DIXIE_RULE_VERSION = '1.0.0';

// FSM de transiciones válidas
const JOB_TRANSITIONS = {
  'VOID':       ['JOB_CREATED'],
  'JOB_CREATED':  ['JOB_ASSIGNED', 'JOB_CANCELED'],
  'JOB_ASSIGNED': ['JOB_STARTED',  'JOB_CANCELED'],
  'JOB_STARTED':  ['JOB_COMPLETED','JOB_CANCELED'],
  'JOB_COMPLETED':['JOB_PAID'],
  'JOB_PAID':     [],
  'JOB_CANCELED': []
};

const PAYMENT_TRANSITIONS = {
  'NONE':    ['JOB_PAID'],
  'PENDING': ['JOB_PAID'],
  'PAID':    []
};

function md5(obj) {
  return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
}

async function getAggregateState(aggregateId) {
  try {
    const eventos = await mongoose.connection.collection('events')
      .find({ aggregateId: String(aggregateId) })
      .sort({ timestamp: 1 })
      .toArray();

    let job     = 'VOID';
    let payment = 'NONE';
    let version = 0;

    for (const e of eventos) {
      version++;
      if (e.type === 'JOB_CREATED')   job = 'JOB_CREATED';
      if (e.type === 'JOB_ASSIGNED')  job = 'JOB_ASSIGNED';
      if (e.type === 'JOB_STARTED')   job = 'JOB_STARTED';
      if (e.type === 'JOB_COMPLETED') job = 'JOB_COMPLETED';
      if (e.type === 'JOB_CANCELED')  job = 'JOB_CANCELED';
      if (e.type === 'JOB_PAID')    { job = 'JOB_PAID'; payment = 'PAID'; }
    }

    return { job, payment, version };
  } catch(e) {
    console.error('[DixieGate] Error leyendo estado:', e.message);
    return { job: 'VOID', payment: 'NONE', version: 0 };
  }
}

function validate(state, event) {
  const issues   = [];
  const allowed  = JOB_TRANSITIONS[state.job]?.includes(event.type) ?? false;

  if (!allowed) {
    issues.push({
      severity: 'ERROR',
      domain:   'job_fsm',
      reason:   `Transición inválida: ${state.job} → ${event.type}`
    });
  }

  if (!event.aggregateId) {
    issues.push({ severity: 'ERROR', domain: 'identity', reason: 'aggregateId ausente' });
  }

  if (!event.entityType) {
    issues.push({ severity: 'WARN', domain: 'schema', reason: 'entityType ausente' });
  }

  return { allowed, issues };
}

async function audit(event, state, result) {
  if (result.issues.length === 0) return; // solo loguear si hay issues

  try {
    await mongoose.connection.collection('dixie_audit_log').insertOne({
      timestamp:   new Date(),
      aggregateId: String(event.aggregateId),
      eventType:   event.type,
      beforeState: {
        job:     state.job     || 'VOID',
        payment: state.payment || 'NONE',
        version: state.version || 1
      },
      expectedTransitions: {
        job:          JOB_TRANSITIONS[state.job     || 'VOID'],
        payment:      PAYMENT_TRANSITIONS[state.payment || 'NONE'],
        rulesVersion: DIXIE_RULE_VERSION
      },
      issues:           result.issues,
      stateFingerprint: md5(state),
      mode:             DIXIE_MODE
    });
    console.log(`[DixieGate] 🔍 Audit: ${event.type} | ${result.issues.length} issue(s) | mode=${DIXIE_MODE}`);
  } catch(e) {
    console.error('[DixieGate] Error escribiendo audit log:', e.message);
  }
}

module.exports = { validate, getAggregateState, audit, DIXIE_MODE };
