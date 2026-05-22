const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI, {family:4}).then(async () => {
  const hash = await bcrypt.hash('2863732', 10);
  const r = await mongoose.connection.db.collection('usuarios').updateOne(
    {email:'ggaston.gastaldi@gmail.com'},
    {$set:{password: hash}}
  );
  console.log(r.modifiedCount ? 'OK - password reseteada' : 'NO ENCONTRADO');
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
