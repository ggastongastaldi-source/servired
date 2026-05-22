const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI, {family:4}).then(async () => {
  const hash = await bcrypt.hash('Leandra3', 10);
  const r = await mongoose.connection.db.collection('usuarios').updateOne(
    {email:'debora.rouiller.1@gmail.com'},
    {$set:{password: hash}}
  );
  console.log(r.modifiedCount ? 'OK' : 'NO ENCONTRADO');
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
