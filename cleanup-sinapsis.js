const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);
client.connect().then(async () => {
  const col = client.db('sinapsis').collection('events');
  const r = await col.deleteMany({ eventId: { $in: [null, 'init-event'] } });
  console.log('Eliminados:', r.deletedCount);
  await client.close();
});
