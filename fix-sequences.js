require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection('events');

  const nullEvents = await col.find({ sequenceNumber: null }).toArray();
  console.log('Eventos sin sequenceNumber:', nullEvents.length);

  const groups = {};
  for (const e of nullEvents) {
    const key = e.aggregateId + '_' + (e.entityType||'unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  for (const [key, events] of Object.entries(groups)) {
    const last = await col.findOne(
      { aggregateId: events[0].aggregateId, entityType: events[0].entityType, sequenceNumber: { $ne: null } },
      { sort: { sequenceNumber: -1 } }
    );
    let seq = (last?.sequenceNumber ?? -1) + 1;
    for (const e of events) {
      await col.updateOne({ _id: e._id }, { $set: { sequenceNumber: seq++ } });
    }
    console.log('Stream', key, '->', events.length, 'eventos actualizados, desde seq', seq - events.length);
  }

  // Dropear índice viejo si existe y recrear
  try { await col.dropIndex('aggregateId_1_sequenceNumber_1'); } catch(e) {}
  await col.createIndex(
    { aggregateId: 1, sequenceNumber: 1 },
    { unique: true, background: true }
  );
  console.log('OK - Indice OCC creado');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
