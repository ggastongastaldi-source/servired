const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI, {family:4}).then(async () => {
  const Usuario = require('./src/core/models/Usuario');
  const existe = await Usuario.findOne({email:'cliente.test@servired.com'});
  if (existe) {
    console.log('YA EXISTE');
  } else {
    await Usuario.create({
      nombre: 'Cliente Test',
      email: 'cliente.test@servired.com',
      password: await bcrypt.hash('Test2026ok', 10),
      rol: 'CLIENTE',
      zona: 'palermo',
      ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] }
    });
    console.log('OK - cliente creado');
  }
  mongoose.disconnect();
}).catch(err => { console.error(err.message); process.exit(1); });
