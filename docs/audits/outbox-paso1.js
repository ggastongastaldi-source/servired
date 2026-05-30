const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection('outbox');

  const dups = await col.aggregate([
    { $group: { _id: '$dispatchId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  console.log('1. Duplicados:', dups.length === 0 ? '✅ Ninguno' : dups);

  const total = await col.countDocuments();
  const porEstado = await col.aggregate([
    { $group: { _id: '$status', total: { $sum: 1 } } }
  ]).toArray();
  console.log(`2. Total: ${total}`);
  console.log('   Por estado:', porEstado);

  await col.createIndex({ status: 1, scheduledAt: 1 }, { name: 'idx_dispatch_queue' });
  console.log('3. idx_dispatch_queue ✅');

  await col.createIndex({ status: 1, dispatchingAt: 1 }, { name: 'idx_dispatch_recovery' });
  console.log('4. idx_dispatch_recovery ✅');

  if (dups.length === 0) {
    await col.createIndex({ dispatchId: 1 }, { unique: true, name: 'uq_dispatch_id' });
    console.log('5. uq_dispatch_id ✅');
  } else {
    console.log('5. uq_dispatch_id ⚠️ OMITIDO — duplicados detectados');
  }

  const indexes = await col.indexes();
  console.log('6. Índices:', indexes.map(i => i.name));

  const fs = require('fs');
  const baseline = { fecha: new Date().toISOString(), total, porEstado, indices: indexes.map(i => i.name), duplicados: dups };
  fs.writeFileSync(`${process.env.HOME}/servired/docs/audits/outbox-baseline-2026-05-30.json`, JSON.stringify(baseline, null, 2));
  console.log('\n📄 Baseline guardado');
  console.log('✅ OUTBOX READY FOR ATOMIC REFACTOR');

  await mongoose.disconnect();
}

main().catch(console.error);
