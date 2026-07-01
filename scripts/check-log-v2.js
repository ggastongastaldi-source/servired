require('dotenv').config();
const mongoose = require('mongoose');
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const coll = db.collection('sinapsis_log_v2');
  const count = await coll.countDocuments();
  const newest = await coll.find().sort({ _id: -1 }).limit(1).toArray();
  console.log('sinapsis_log_v2 count:', count);
  console.log('newest ts:', newest[0] ? newest[0]._id.getTimestamp() : 'N/A (vacia o inexistente)');
  console.log('newest doc keys:', newest[0] ? Object.keys(newest[0]).join(', ') : 'N/A');
  const hoursSinceLastWrite = newest[0] ? (Date.now() - newest[0]._id.getTimestamp()) / 3600000 : null;
  console.log('horas desde ultima escritura:', hoursSinceLastWrite !== null ? hoursSinceLastWrite.toFixed(1) : 'N/A');
  await mongoose.disconnect();
}
main().catch(e => { console.error('Error (posiblemente inexistente):', e.message); process.exit(0); });
