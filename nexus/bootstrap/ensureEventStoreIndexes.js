// EventStore — índices deterministas para OCC
const mongoose = require('mongoose');

async function ensureEventStoreIndexes() {
  const db = mongoose.connection.db;

  // events — índice único por eventId
  await db.collection('events').createIndex(
    { eventId: 1 },
    { unique: true, background: true }
  );

  // events — índice único por streamId + sequenceNumber (OCC)
  await db.collection('events').createIndex(
    { aggregateId: 1, sequenceNumber: 1 },
    { unique: true, background: true }
  );

  // events — query temporal
  await db.collection('events').createIndex(
    { aggregateId: 1, timestamp: 1 },
    { background: true }
  );

  // snapshots — último por aggregate
  await db.collection('snapshots').createIndex(
    { aggregateId: 1, entityType: 1, version: -1 },
    { background: true }
  );

  console.log('[EventStore] ✅ Índices OCC creados');
}

module.exports = { ensureEventStoreIndexes };
