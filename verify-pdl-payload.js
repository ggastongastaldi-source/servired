const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

client.connect().then(async () => {
  const db = client.db('sinapsis');
  const ev = await db.collection('events')
    .findOne({ eventType: 'LeadQualified' }, { sort: { timestamp: -1 } });

  console.log('LeadQualified payload real:');
  console.log(JSON.stringify(ev?.payload, null, 2));
  console.log('\nmetadata.rule:', ev?.metadata?.rule);

  await client.close();
});
