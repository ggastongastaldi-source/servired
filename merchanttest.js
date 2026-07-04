require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Usuario = require('./src/core/models/Usuario');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'test.merchant.nexus@servired.online';
  let u = await Usuario.findOne({ email });
  if (!u) {
    u = await Usuario.create({
      nombre: 'Test Merchant Nexus',
      email,
      password: 'placeholder_hash_no_login',
      rol: 'CLIENTE',
      roles: ['CLIENTE'],
      estado: 'ACTIVO',
      ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] }
    });
    console.log('Usuario creado:', u._id.toString());
  } else {
    console.log('Usuario ya existia:', u._id.toString());
  }

  const token = jwt.sign(
    { id: u._id, userId: u._id, nombre: u.nombre, rol: u.rol },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('TOKEN:', token);
  await mongoose.disconnect();
})();
