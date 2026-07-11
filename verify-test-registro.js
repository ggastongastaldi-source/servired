require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');
const Commerce = require('./src/core/models/Commerce');
const BusinessProfile = require('./models/BusinessProfile');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired');

  const email = 'qa-comercio-test@example.com';
  const u = await Usuario.findOne({ email }).lean();
  console.log('Usuario:', u ? { _id: u._id.toString(), rol: u.rol, roles: u.roles, provider: u.provider, tienePasswordHash: !!u.password } : 'NO ENCONTRADO');

  const c = await Commerce.findOne({ email }).lean();
  console.log('Commerce:', c ? { _id: c._id.toString(), rubro: c.rubro, tieneQR: !!c.qr_code } : 'NO ENCONTRADO');

  if (u) {
    const bp = await BusinessProfile.findOne({ usuarioId: u._id }).lean();
    console.log('BusinessProfile:', bp ? { _id: bp._id.toString(), commerceId: bp.commerceId?.toString(), rubroId: bp.rubroId, estado: bp.estado } : 'NO ENCONTRADO');
    if (bp && c) {
      console.log('Vínculo BusinessProfile.commerceId === Commerce._id:', bp.commerceId?.toString() === c._id.toString());
    }
  }

  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
