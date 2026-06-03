const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoUri } = require('../config/database');

const { capturePayment } = require('../src/old_structure/services/financeEngine');

async function run() {
  await mongoose.connect(getMongoUri());
  console.log('✅ Conectado a MongoDB');

  const payload = {
    provider:                'mercadopago',
    provider_transaction_id: `test_${Date.now()}`,
    order_id:                `order_test_${Date.now()}`,
    amount:                  7500,
  };

  // Idempotencia: la primera commitea, las demás deben encontrarla como duplicado
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(await capturePayment(payload));
  }

  const ok  = results.filter(r => r.success && !r.reason);
  const dup = results.filter(r => r.reason === 'DUPLICATE_REQUEST_IGNORED');
  const err = results.filter(r => !r.success);

  console.log(`✅ Exitosos:   ${ok.length}  (esperado: 1)`);
  console.log(`🔁 Duplicados: ${dup.length} (esperado: 4)`);
  console.log(`❌ Errores:    ${err.length}  (esperado: 0)`);

  const pass = ok.length === 1 && dup.length === 4 && err.length === 0;
  console.log(pass ? '\n✅ TEST PASADO' : '\n❌ TEST FALLIDO');

  await mongoose.disconnect();
  process.exit(pass ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
