const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI, {family:4}).then(async () => {
  const u = await mongoose.connection.db.collection('usuarios').findOne({email:'debora.rouiller.1@gmail.com'});
  console.log('Usuario:', u ? u.email + ' rol:' + u.rol : 'NO ENCONTRADO');
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
