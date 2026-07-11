require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired');
  const users = await Usuario.find({ rol: 'COMERCIO' }).select('email estado provider googleId').lean();
  console.log('Total con rol COMERCIO:', users.length);
  users.forEach(u => console.log({
    email: u.email.replace(/(.{2}).+(@.+)/, '$1***$2'),
    estado: u.estado, provider: u.provider, tieneGoogleId: !!u.googleId
  }));
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
