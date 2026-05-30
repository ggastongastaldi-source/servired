const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Conectado a Atlas');

  const db = client.db('sinapsis');
  const col = db.collection('events');

  await col.insertOne({
    eventId: 'init-event',
    correlationId: 'init-correlation',
    causationId: null,
    aggregateId: 'init-aggregate',
    aggregateType: 'System',
    eventType: 'StoreInitialized',
    timestamp: new Date().toISOString(),
    payload: { message: 'SINAPSIS Event Store iniciado' },
    metadata: { version: 1, origin: 'TermuxScanner', ingestedAt: new Date().toISOString() }
  });
  console.log('✅ Colección events creada');

  await col.createIndex({ eventId: 1 }, { unique: true });
  await col.createIndex({ aggregateId: 1, timestamp: 1 });
  await col.createIndex({ correlationId: 1 });
  await col.createIndex({ causationId: 1 });
  await col.createIndex({ eventType: 1 });
  await col.createIndex({ timestamp: 1 });
  console.log('✅ 6 índices creados');

  await client.close();
  console.log('\n🧠 sinapsis.events lista para producción');
}

init().catch(console.error);
