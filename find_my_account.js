require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Usuario = require('./models/Usuario');

  console.log('🔍 Buscando cualquier email que contenga "gaston" (case-insensitive)...\n');
  const candidatos = await Usuario.find({
    email: { $regex: 'gaston', $options: 'i' }
  }).select('email nombre rol roles estado provider createdAt').lean();

  if (candidatos.length === 0) {
    console.log('❌ Ningún usuario con "gaston" en el email.');
  } else {
    candidatos.forEach(u => {
      console.log('---');
      console.log('  email:', JSON.stringify(u.email)); // JSON.stringify muestra espacios ocultos
      console.log('  nombre:', u.nombre);
      console.log('  rol:', u.rol, '| roles:', u.roles);
      console.log('  estado:', u.estado);
      console.log('  provider:', u.provider || 'local');
      console.log('  creado:', u.createdAt);
    });
  }

  console.log('\n🔍 Buscando por nombre que contenga "Gaston" o "Gastaldi"...\n');
  const porNombre = await Usuario.find({
    nombre: { $regex: 'gasta', $options: 'i' }
  }).select('email nombre rol roles estado').lean();
  porNombre.forEach(u => {
    console.log('---');
    console.log('  email:', JSON.stringify(u.email));
    console.log('  nombre:', u.nombre);
    console.log('  rol:', u.rol, '| roles:', u.roles);
  });

  await mongoose.disconnect();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
