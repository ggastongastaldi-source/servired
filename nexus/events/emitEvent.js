// ServiRed — Nexus Universal Emitter v3.0
// Event Envelope completo según prompt maestro
// eventId, correlationId, causationId, rootCauseId

const crypto   = require('crypto');
const mongoose = require('mongoose');
const { AsyncLocalStorage } = require('async_hooks');

const DIXIE_MODE = process.env.DIXIE_MODE || 'observe';

// Context Propagation — AsyncLocalStorage para correlationId
const contextStorage = new AsyncLocalStorage();

function getContext() {
  return contextStorage.getStore() || {};
}

function runWithContext(ctx, fn) {
  return contextStorage.run(ctx, fn);
}

function startCorrelation(correlationId, rootCauseId) {
  return {
    correlationId: correlationId || crypto.randomUUID(),
    rootCauseId:   rootCauseId   || correlationId || crypto.randomUUID(),
    causationId:   null,
  };
}

function emitEvent({
  entityType,
  type,
  aggregateId,
  payload = {},
  causationId = null,
  correlationId = null,
  rootCauseId = null,
}) {
  if (!entityType || !type || !aggregateId) {
    console.warn('[Nexus] ⚠️ Evento omitido — faltan campos obligatorios');
    return;
  }

  // Heredar contexto del AsyncLocalStorage si existe
  const ctx = getContext();

  const event = {
    eventId:       crypto.randomUUID(),
    correlationId: correlationId || ctx.correlationId || crypto.randomUUID(),
    causationId:   causationId   || ctx.causationId   || null,
    rootCauseId:   rootCauseId   || ctx.rootCauseId   || null,
    version:       1,
    entityType:    String(entityType).toLowerCase(),
    type:          String(type).toUpperCase(),
    aggregateId:   String(aggregateId),
    payload,
    timestamp:     new Date(),
    metadata: {
      environment:     process.env.NODE_ENV || 'production',
      source:          'servired-nexus',
      nodeVersion:     process.version,
      pid:             process.pid,
      workflowVersion: '1.0',
      policyVersion:   '1.0',
      channel:         ctx.channel || 'internal',
      zone:            ctx.zone    || 'AMBA',
      circuitState:    ctx.circuitState || 'CLOSED',
      traceDepth:      (ctx.traceDepth || 0) + 1,
    }
  };

  // Dixie Gate interceptor — async, nunca bloquea
  _dixieIntercept(event).catch(() => {});

  // Persistencia fire-and-forget
  mongoose.connection.collection('events').insertOne(event)
    .then(() => console.log(
      `[Nexus] 📡 [${event.entityType}] ${event.type} → ${event.aggregateId} | corr:${event.correlationId.slice(0,8)}`
    ))
    .catch(err => console.error(`[Nexus-Error] [${entityType}:${type}]:`, err.message));
}

async function _dixieIntercept(event) {
  try {
    const { validate, getAggregateState, audit } = require('../dixie/gate');
    const state  = await getAggregateState(event.aggregateId);
    const result = validate(state, event);
    if (result.issues.length > 0) {
      await audit(event, state, result);
      if (DIXIE_MODE === 'enforce' && !result.allowed) {
        throw new Error(`[DixieGate] Evento bloqueado: ${event.type}`);
      }
    }
  } catch(e) {
    if (DIXIE_MODE !== 'enforce') {
      console.error('[DixieGate] Error (ignorado):', e.message);
    } else {
      throw e;
    }
  }
}

module.exports = { emitEvent, runWithContext, startCorrelation, getContext, contextStorage };
