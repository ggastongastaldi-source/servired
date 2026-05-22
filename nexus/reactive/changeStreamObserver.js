// Nexus Single Reactive Observer v1.3 — Protected Core
// Observa coleccion 'events'. NUNCA modifica estado.
const mongoose        = require('mongoose');
const StreamCheckpoint = require('./StreamCheckpoint');

let isReconnecting = false;

async function iniciarObserver(io) {
  try {
    const col        = mongoose.connection.collection('events');
    const checkpoint = await StreamCheckpoint.findOne({ streamId: 'universal_events_stream' });
    const options    = checkpoint?.resumeToken ? { resumeAfter: checkpoint.resumeToken } : {};

    const stream = col.watch([], options);
    console.log('[Nexus] 👁️ Change Stream activo sobre: events',
      checkpoint ? '(desde checkpoint)' : '(desde ahora)');

    stream.on('change', async (change) => {
      if (change.operationType !== 'insert') return;
      const event = change.fullDocument;

      // Persistir resume token — async silencioso
      StreamCheckpoint.updateOne(
        { streamId: 'universal_events_stream' },
        { $set: { resumeToken: change._id, updatedAt: new Date() } },
        { upsert: true }
      ).catch(e => console.error('[Nexus-Checkpoint]:', e.message));

      // Routing por dominio
      if      (event.entityType === 'job')     procesarJobEvent(event, io);
      else if (event.entityType === 'lead')    procesarLeadEvent(event, io);
      else if (event.entityType === 'worker')  { /* futuro */ }
      else if (event.entityType === 'payment') { /* futuro */ }
    });

    stream.on('error', (err) => {
      console.error('[Nexus-Stream-Error]:', err.message);
    });

    // Singleton reconnect guard — evita loops y listeners duplicados
    stream.on('close', () => {
      if (isReconnecting) return;
      isReconnecting = true;
      console.warn('[Nexus] Stream cerrado — reconectando en 5s...');
      setTimeout(async () => {
        isReconnecting = false;
        await iniciarObserver(io).catch(() => {});
      }, 5000);
    });

  } catch(err) {
    console.error('[Nexus-Observer-Init]:', err.message);
    if (!isReconnecting) {
      isReconnecting = true;
      setTimeout(async () => {
        isReconnecting = false;
        await iniciarObserver(io).catch(() => {});
      }, 10000);
    }
  }
}

function procesarJobEvent(event, io) {
  console.log(`[Nexus-Reactive] ⚡ job: ${event.type}`);
  if (event.type === 'JOB_CREATED')
    io.to('admins').emit('nexus:job:created', { pedidoId: event.aggregateId, ...event.payload });
  else if (event.type === 'JOB_ASSIGNED')
    io.to('admins').emit('nexus:job:assigned', { pedidoId: event.aggregateId, ...event.payload });
  else if (event.type === 'JOB_COMPLETED')
    io.to('admins').emit('nexus:job:completed', { pedidoId: event.aggregateId, ...event.payload });
}

function procesarLeadEvent(event, io) {
  console.log(`[Nexus-Reactive] ⚡ lead: ${event.type}`);
  io.to('admins').emit('nexus:lead', { type: event.type, leadId: event.aggregateId, ...event.payload });
}

module.exports = { iniciarObserver };
