const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

client.connect().then(async () => {
  const col = client.db('sinapsis').collection('events');
  
  const total = await col.countDocuments();
  console.log(`📊 Total eventos en Atlas: ${total}`);

  const last = await col.find().sort({ timestamp: -1 }).limit(6).toArray();
  const correlationId = last[0]?.correlationId;
  
  console.log(`\n🔍 Último correlationId: ${correlationId}`);
  console.log(`📋 Eventos de esa correlación:`);
  
  last.forEach(e => {
    console.log(`   ${e.eventType} | ${e.aggregateId} | ${e.timestamp}`);
  });

  await client.close();
});
