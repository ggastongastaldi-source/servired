const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

client.connect().then(async () => {
  const db = client.db('servired');

  const outbox = await db.collection('outbox')
    .find({}).sort({ createdAt: -1 }).limit(10).toArray();

  console.log(`\n📥 Outbox — ${outbox.length} mensaje(s)`);
  outbox.forEach(o => {
    console.log(`  ${o.status} | ${o.channel}/${o.template} | ${o.dispatchId?.slice(0,8)}...`);
  });

  await client.close();
});
