const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI, {family:4}).then(async () => {
  const Usuario = require('./src/old_structure/models/Usuario');
  const hash = await bcrypt.hash('debora123', 10);
  const r = await Usuario.updateOne(
    {email:'debora.rouiller.1@gmail.com'},
    {$set:{password: hash}}
  );
  console.log('Reset Debora:', r.modifiedCount ? 'OK' : 'NO ENCONTRADA');
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
