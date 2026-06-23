'use strict';
/**
 * Fix payments PENDING > 24h — marcar como STALE para revisión manual.
 * No cambia a REJECTED automáticamente (requiere verificación MP).
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const coll = db.collection('payments');

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stuck = await coll.find({ status: 'PENDING', createdAt: { $lt: cutoff } }).toArray();

  console.log(`Payments stuck encontrados: ${stuck.length}`);
  for (const p of stuck) {
    console.log(`  ID: ${p._id} | ref: ${p.externalReference} | createdAt: ${p.createdAt}`);
  }

  if (stuck.length > 0) {
    // Marcar con flag stale para revisión — NO cambiar status todavía
    const result = await coll.updateMany(
      { status: 'PENDING', createdAt: { $lt: cutoff } },
      { $set: { stale: true, staleDetectedAt: new Date() } }
    );
    console.log(`Marcados como stale: ${result.modifiedCount}`);
    console.log('Acción recomendada: verificar en panel MP si el pago fue acreditado.');
  }

  await mongoose.disconnect();
}
run().catch(e => { console.error('Error:', e.message); process.exit(1); });
