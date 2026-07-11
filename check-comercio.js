require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');
const BusinessProfile = require('./models/BusinessProfile');

(async () => {
  const email = process.argv[2];
  if (!email) { console.log('Uso: node check-comercio.js email@ejemplo.com'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired');

  const u = await Usuario.findOne({ email }).lean();
  if (!u) { console.log('Usuario: NO ENCONTRADO'); process.exit(0); }
  console.log('Usuario:', { _id: u._id.toString(), rol: u.rol, estado: u.estado, provider: u.provider });

  const bp = await BusinessProfile.findOne({ usuarioId: u._id }).lean();
  console.log('BusinessProfile:', bp
    ? { _id: bp._id.toString(), estado: bp.estado, nombreComercial: bp.nombreComercial }
    : null);

  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
