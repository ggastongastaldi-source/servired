const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI, {family:4}).then(async () => {
  const Usuario = require('./src/old_structure/models/Usuario');
  const hash = await bcrypt.hash('Test2026ok', 10);
  const r = await Usuario.updateOne(
    {email:'cliente.test@servired.com'},
    {$set:{password: hash}}
  );
  console.log('Reset:', r.modifiedCount ? 'OK' : 'NO MODIFICADO');
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
