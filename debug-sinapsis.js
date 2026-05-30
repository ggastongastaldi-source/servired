const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

client.connect().then(async () => {
  const col = client.db('sinapsis').collection('events');
  const docs = await col.find().sort({ _id: -1 }).limit(3).toArray();
  console.log(JSON.stringify(docs, null, 2));
  await client.close();
});
