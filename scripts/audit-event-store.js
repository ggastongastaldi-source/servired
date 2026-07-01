require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const collections = ['sinapsis_bus_log', 'business_events', 'marketing_events'];
  console.log('=== EVENT STORE AUDIT ===\n');
  const typesByColl = {};
  for (const name of collections) {
    try {
      const coll = db.collection(name);
      const count = await coll.countDocuments();
      const newest = await coll.find().sort({ _id: -1 }).limit(1).toArray();
      const oldest = await coll.find().sort({ _id: 1 }).limit(1).toArray();
      const doc = newest[0];
      const hasHash = doc ? ('prevHash' in doc || 'hash' in doc) : false;
      let types = [];
      try { types = await coll.distinct('type'); } catch (e) {}
      if (!types.length) { try { types = await coll.distinct('eventType'); } catch (e) {} }
      typesByColl[name] = types;
      console.log(`--- ${name} ---`);
      console.log(`count: ${count}`);
      console.log(`hash-chain fields present (prevHash/hash): ${hasHash}`);
      console.log(`doc keys (latest): ${doc ? Object.keys(doc).join(', ') : 'N/A'}`);
      console.log(`distinct types (first 20): ${types.slice(0, 20).join(', ')}`);
      console.log(`oldest ts: ${oldest[0] ? oldest[0]._id.getTimestamp() : 'N/A'}`);
      console.log(`newest ts: ${doc ? doc._id.getTimestamp() : 'N/A'}`);
      console.log('');
    } catch (e) {
      console.log(`--- ${name} --- ERROR: ${e.message}\n`);
      typesByColl[name] = [];
    }
  }
  console.log('=== CROSS-COLLECTION TYPE OVERLAP ===');
  console.log(JSON.stringify(typesByColl, null, 2));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
