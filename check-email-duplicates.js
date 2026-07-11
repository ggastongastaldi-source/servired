require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired');

  const dupes = await Usuario.aggregate([
    { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 }, emails: { $push: '$email' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log('Duplicados case-insensitive encontrados:', dupes.length);
  dupes.forEach(d => console.log({
    normalizado: d._id.replace(/(.{2}).+(@.+)/, '$1***$2'),
    variantes: d.emails.map(e => e.replace(/(.{2}).+(@.+)/, '$1***$2')),
    cantidad: d.count
  }));

  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
