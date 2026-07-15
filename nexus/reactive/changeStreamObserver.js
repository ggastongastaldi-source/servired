// Nexus Single Reactive Observer v2.0 — War Mode
// Observa 'events'. NUNCA modifica estado. Resiliente a caidas de Atlas.
const mongoose         = require('mongoose');
const StreamCheckpoint = require('./StreamCheckpoint');

const { jobRequestedReactor, init: initJobReactor } = require('./jobRequestedReactor');

let isReconnecting = false;
let activeStream   = null;

// Detecta si el error es de oplog expirado
function isOplogExpiredError(err) {
  const msg = err?.message || '';
  return msg.includes('Resume of change stream was not possible') ||
         msg.includes('resume point may no longer be in the oplog') ||
         err?.code === 286 || err?.codeName === 'ChangeStreamHistoryLost';
}

async function limpiarCheckpoint() {
  try {
    await StreamCheckpoint.deleteOne({ targetCollection: 'events' });
    console.warn('[Nexus] ⚠️  Checkpoint expirado eliminado — stream reiniciará desde ahora');
  } catch(e) {
    console.error('[Nexus-Checkpoint-Delete-Error]:', e.message);
  }
}

async function iniciarObserver(io) {
  // Cerrar stream previo si existe (evitar zombies)
  if (activeStream) {
    try { await activeStream.close(); } catch(_) {}
    activeStream = null;
  }

  try {
    const col        = mongoose.connection.collection('events');
    const checkpoint = await StreamCheckpoint.findOne({ targetCollection: 'events' })
      .lean().catch(() => null);

    const options = {
      fullDocument:   'updateLookup',
      maxAwaitTimeMS: 10000,
      ...(checkpoint?.resumeToken ? { resumeAfter: checkpoint.resumeToken } : {})
    };

    activeStream = col.watch([{ $match: { operationType: 'insert' } }], options);

    console.log('[Nexus] 👁️  Observer v2.0 activo — events',
      checkpoint?.resumeToken ? '(desde checkpoint)' : '(desde ahora)');

    activeStream.on('change', async (change) => {
      const event = change.fullDocument;
      if (!event?.entityType || !event?.type) return;

      // Persistir resumeToken — async silencioso, nunca bloquea
      StreamCheckpoint.updateOne(
        { targetCollection: 'events' },
        { $set: { resumeToken: change._id, updatedAt: new Date() } },
        { upsert: true }
      ).catch(e => console.error('[Nexus-Checkpoint-Error]:', e.message));

      // Log estructurado
      console.log(`[Nexus] 📥 ${event.entityType.toUpperCase()}:${event.type} | agg:${event.aggregateId} | ${new Date().toISOString()}`);

      // Routing por dominio
      try {
        if      (event.entityType === 'job')    { procesarJobEvent(event, io); procesarMarketFieldEvent(event); jobRequestedReactor(event); }
        else if (event.entityType === 'lead')     procesarLeadEvent(event, io);
        else if (event.entityType === 'worker')   { /* Sprint 2 */ }
        else if (event.entityType === 'payment')  { /* Sprint 3 */ }
        else if (event.entityType === 'finance')  procesarFinanceEvent(event, io);
        else if (event.entityType === 'merchant' ||
                 event.entityType === 'catalog')  procesarMerchantEvent(event);
      } catch(e) {
        console.error('[Nexus-Routing-Error]:', e.message, '| event:', event.type);
      }

      // Trust & Risk — Shadow Mode (nunca bloquea el observer)
      try {
        const { procesarTrustEvent } = require('./trustRiskBridge');
        procesarTrustEvent(event).catch(() => {});
      } catch(_) {}
    });

    activeStream.on('error', async (err) => {
      console.error('[Nexus-Stream-Error]:', err.message);
      if (isOplogExpiredError(err)) {
        await limpiarCheckpoint();
      }
      scheduleReconnect(io);
    });

    activeStream.on('close', () => {
      console.warn('[Nexus] Stream cerrado inesperadamente');
      scheduleReconnect(io);
    });

  } catch(err) {
    console.error('[Nexus-Observer-Init-Error]:', err.message);
    if (isOplogExpiredError(err)) {
      await limpiarCheckpoint();
    }
    scheduleReconnect(io);
  }
}

function scheduleReconnect(io) {
  if (isReconnecting) return;
  isReconnecting = true;
  const delay = 5000;
  console.warn(`[Nexus] Reconectando en ${delay/1000}s...`);
  setTimeout(async () => {
    isReconnecting = false;
    await iniciarObserver(io).catch(e =>
      console.error('[Nexus-Reconnect-Error]:', e.message)
    );
  }, delay);
}

// ── Processors ───────────────────────────────────────────

function procesarJobEvent(event, io) {
  const { type, aggregateId, payload } = event;
  const base = { pedidoId: aggregateId, ...payload, _nexusTs: new Date().toISOString() };

  switch(type) {
    case 'JOB_CREATED':
      io.to('admins').emit('nexus:job:created', base);
      break;
    case 'JOB_ASSIGNED':
      io.to('admins').emit('nexus:job:assigned', base);
      if (payload?.workerId)
        io.to('worker_' + payload.workerId).emit('nexus:job:assigned', base);
      break;
    case 'JOB_COMPLETED':
      io.to('admins').emit('nexus:job:completed', base);
      break;
    case 'JOB_CANCELED':
      io.to('admins').emit('nexus:job:canceled', base);
      break;
    default:
      console.log('[Nexus] Evento job sin handler:', type);
  }
}

function procesarLeadEvent(event, io) {
  const { type, aggregateId, payload } = event;
  io.to('admins').emit('nexus:lead', {
    type, leadId: aggregateId, ...payload,
    _nexusTs: new Date().toISOString()
  });
}

function procesarMerchantEvent(event) {
  try {
    const { procesarEvento } = require('../../services/merchantProjectionReactor');
    procesarEvento({
      eventType:  event.type,
      hash:       event.eventId,
      payload:    event.payload || {},
      properties: event.payload || {}
    }).catch(e => {
      console.error('[MerchantReactor] error procesando evento:', event.type, e);
    });
  } catch (e) {
    console.error('[MerchantReactor] require falló:', e.message);
  }
}

function procesarFinanceEvent(event, io) {
  const { type, aggregateId, payload } = event;
  const base = { ...payload, _nexusTs: new Date().toISOString() };

  switch (type) {
    case 'WorkerFundsReleased': {
      const workerId = payload.workerId;
      if (workerId) {
        io.to('worker_' + workerId).emit('gia:priority:refresh', {
          reason:  'WorkerFundsReleased',
          payload: base
        });
        io.to('admins').emit('nexus:finance:released', {
          workerId, amount: payload.amount, ...base
        });
      }
      console.log(`[Finance] 💰 WorkerFundsReleased — worker:${workerId} amount:${payload.amount}`);
      break;
    }
    case 'WorkerWithdrawalCompleted': {
      const workerId = payload.worker_id;
      if (workerId) {
        io.to('worker_' + workerId).emit('gia:priority:refresh', {
          reason:  'WithdrawalCompleted',
          payload: base
        });
        io.to('admins').emit('nexus:finance:withdrawal', {
          workerId, amount: payload.amount, ...base
        });
      }
      console.log(`[Finance] 🏦 WithdrawalCompleted — worker:${workerId} amount:${payload.amount}`);
      break;
    }
    default:
      console.log(`[Finance] Evento sin handler: ${type}`);
  }
}

module.exports = { iniciarObserver };

async function _notifyNarrative(event) {
  try {
    const { observe } = require('../application/narrativeObserver');
    await observe(event);
  } catch(e) {}
}
