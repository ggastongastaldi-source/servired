require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Usuario = require('./src/old_structure/models/Usuario.js');

  const result = await Usuario.updateMany(
    { roles: { $in: ['TRABAJADOR'] }, wallet_available: { $exists: false } },
    { $set: { wallet_available: 0, wallet_pending: 0 } }
  );

  console.log('[MIGRATION] wallet_available inicializado en', result.modifiedCount, 'trabajadores');

  const result2 = await Usuario.updateMany(
    { roles: { $in: ['TRABAJADOR'] }, wallet_available: null },
    { $set: { wallet_available: 0, wallet_pending: 0 } }
  );

  console.log('[MIGRATION] wallet_available null -> 0 en', result2.modifiedCount, 'trabajadores');

  // Verificar resultado
  const pendientes = await Usuario.countDocuments({
    roles: { $in: ['TRABAJADOR'] },
    $or: [{ wallet_available: { $exists: false } }, { wallet_available: null }]
  });
  console.log('[MIGRATION] Trabajadores sin wallet después de migración:', pendientes);

  mongoose.disconnect();
}).catch(e => { console.error('[MIGRATION] Error:', e.message); process.exit(1); });
