require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');
const Referido = require('./src/models/Referido');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  const ref = await Referido.findOne({ ref_code: 'FERRETERIA001' });
  console.log('=== Referido FERRETERIA001 ===');
  console.log(ref ? ref.toObject() : 'No encontrado');

  console.log('\n=== Usuarios test-qr-* ===');
  const users = await Usuario.find(
    { email: { $regex: '^test-qr-' } },
    { email: 1, rol: 1, client_origin_ref: 1, worker_origin_ref: 1, createdAt: 1 }
  ).lean();
  console.log(users.length ? users : 'Ninguno encontrado');

  await mongoose.disconnect();
}
check().catch(console.error);
