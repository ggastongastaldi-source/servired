const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const r = await mongoose.connection.collection('outbox').aggregate([
    { $group: { _id: '$status', total: { $sum: 1 } } }
  ]).toArray();
  console.log('Outbox post-refactor:', r.length === 0 ? '✅ Vacío (sin mensajes encolados)' : r);
  mongoose.disconnect();
});
