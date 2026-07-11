require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./src/core/models/Usuario');
const BusinessProfile = require('./models/BusinessProfile');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired');

  const users = await Usuario.find({ googleId: { $exists: true, $ne: null } })
    .select('email rol estado').lean();

  for (const u of users) {
    const bp = await BusinessProfile.findOne({ usuarioId: u._id }).lean();
    console.log({
      email: u.email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      rol: u.rol,
      estado: u.estado,
      tieneBusinessProfile: !!bp,
      bpEstado: bp ? bp.estado : null,
      bpNombreComercial: bp ? bp.nombreComercial : null
    });
  }
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
