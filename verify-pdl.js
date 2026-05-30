const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);

client.connect().then(async () => {
  const db = client.db('sinapsis');

  // Eventos de decisión emitidos por PDL
  const decisions = await db.collection('events')
    .find({ 'metadata.origin': 'PDL' })
    .sort({ timestamp: -1 })
    .limit(10)
    .toArray();

  console.log(`\n🧠 PDL — Eventos de decisión: ${decisions.length}`);
  decisions.forEach(e => {
    console.log(`  ${e.eventType} | ${e.aggregateId} | causationId: ${e.causationId?.slice(0,8)}...`);
  });

  // Estado de leads_view
  const lead = await db.collection('leads_view')
    .findOne({ aggregateId: 'lead-e1412bce' });

  console.log('\n📊 leads_view:');
  console.log(`  status:    ${lead?.status}`);
  console.log(`  score:     ${lead?.score}`);
  console.log(`  qualified: ${lead?.qualified}`);
  console.log(`  escalated: ${lead?.escalated}`);
  console.log(`  rejected:  ${lead?.rejected}`);

  await client.close();
});
