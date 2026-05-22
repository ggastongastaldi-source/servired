// Change Stream Observer — Capa Reactiva Nexus
// Observa job_events y lead_events, retransmite por socket
// NUNCA modifica estado. Solo observa y retransmite.

const mongoose = require('mongoose');
const StreamCheckpoint = require('./StreamCheckpoint');

let _io = null;

async function iniciarObserver(io) {
  _io = io;
  console.log('[Nexus] Iniciando Change Stream Observer...');
  await observarCollection('job_events', onJobEvent);
  await observarCollection('lead_events', onLeadEvent);
}

async function observarCollection(colName, handler) {
  try {
    const col = mongoose.connection.collection(colName);
    const checkpoint = await StreamCheckpoint.findOne({ collection: colName });
    const options = { fullDocument: 'updateLookup' };
    if (checkpoint?.resumeToken) options.resumeAfter = checkpoint.resumeToken;

    const stream = col.watch([{ $match: { operationType: 'insert' } }], options);

    stream.on('change', async (change) => {
      try {
        await handler(change.fullDocument);
        // Persistir resume token
        await StreamCheckpoint.findOneAndUpdate(
          { collection: colName },
          { resumeToken: change._id, updatedAt: new Date() },
          { upsert: true }
        );
      } catch(e) {
        console.error('[Nexus] Error procesando change:', e.message);
      }
    });

    stream.on('error', async (e) => {
      console.error('[Nexus] Stream error en', colName, ':', e.message);
      // Reintentar en 5s
      setTimeout(() => observarCollection(colName, handler), 5000);
    });

    console.log('[Nexus] Observando:', colName, checkpoint ? '(desde checkpoint)' : '(desde ahora)');
  } catch(e) {
    console.error('[Nexus] Error iniciando observer:', colName, e.message);
    setTimeout(() => observarCollection(colName, handler), 5000);
  }
}

function onJobEvent(event) {
  if (!_io || !event) return;
  // Emitir a admins siempre
  _io.to('admins').emit('nexus:job', {
    type: event.type,
    pedidoId: event.aggregateId,
    payload: event.payload,
    timestamp: event.timestamp
  });
  // Emitir a room del pedido si existe
  if (event.aggregateId) {
    _io.to('pedido_' + event.aggregateId).emit('nexus:job', {
      type: event.type,
      payload: event.payload
    });
  }
  console.log('[Nexus] 📡 job:', event.type);
}

function onLeadEvent(event) {
  if (!_io || !event) return;
  _io.to('admins').emit('nexus:lead', {
    type: event.type,
    leadId: event.aggregateId,
    payload: event.payload,
    timestamp: event.timestamp
  });
  console.log('[Nexus] 📡 lead:', event.type);
}

module.exports = { iniciarObserver };
