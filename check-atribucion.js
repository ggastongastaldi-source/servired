require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');
const Referido = require('./src/models/Referido');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  const u = await Usuario.findOne(
    { email: 'test-qr-003@example.com' },
    { email: 1, client_origin_ref: 1, worker_origin_ref: 1, rol: 1 }
  );
  console.log('=== Usuario ===');
  console.log(u || 'No encontrado');

  const r = await Referido.findOne({ ref_code: 'FERRETERIA001' });
  console.log('\n=== Referido FERRETERIA001 ===');
  console.log(r ? r.stats : 'No encontrado');

  await mongoose.disconnect();
}
check().catch(console.error);
