require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired');
  const users = await Usuario.find({ googleId: { $exists: true, $ne: null } })
    .select('email rol estado provider').lean();
  users.forEach(u => console.log({ email: u.email.replace(/(.{2}).+(@.+)/, '$1***$2'), rol: u.rol, estado: u.estado }));
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
