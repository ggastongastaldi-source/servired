require('dotenv').config();
const mongoose = require('mongoose');
const Referido = require('../src/models/Referido');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await Referido.findOneAndUpdate(
    { ref_code: 'FERRETERIA001' },
    { ref_code: 'FERRETERIA001', nombre: 'Ferretería El Tornillo', zona: 'Isidro Casanova', tipo: 'ferreteria', activo: true },
    { upsert: true, new: true }
  );
  console.log('✅ Referido seed OK');
  await mongoose.disconnect();
}
seed().catch(console.error);
