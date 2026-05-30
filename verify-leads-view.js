const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

client.connect().then(async () => {
  const db = client.db('sinapsis');
  const leads = await db.collection('leads_view').find().sort({ updatedAt: -1 }).limit(3).toArray();
  console.log(`📊 leads_view — ${leads.length} documento(s)\n`);
  leads.forEach(l => {
    console.log(`aggregateId: ${l.aggregateId}`);
    console.log(`status:      ${l.status}`);
    console.log(`category:    ${l.category}`);
    console.log(`score:       ${l.score}`);
    console.log(`converted:   ${l.convertedAt ?? 'no'}`);
    console.log('---');
  });
  await client.close();
});
