require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/database');

const EXPECTED = {
  financial_transactions: [
    { key: { transaction_id: 1 },              unique: true,  name: 'transaction_id_unique' },
    { key: { provider: 1, provider_transaction_id: 1 }, unique: true, name: 'provider_idempotency' },
  ],
  ledger: [
    { key: { transaction_id: 1, account: 1 },  unique: false, name: 'ledger_txn_account' },
  ],
};

async function run() {
  await mongoose.connect(getMongoUri());
  const db = mongoose.connection.db;
  let allOk = true;

  for (const [col, expected] of Object.entries(EXPECTED)) {
    console.log(`\n📋 Colección: ${col}`);
    const existing = await db.collection(col).indexes();
    const existingKeys = existing.map(i => JSON.stringify(i.key));

    for (const exp of expected) {
      const keyStr = JSON.stringify(exp.key);
      const found  = existing.find(i => JSON.stringify(i.key) === keyStr);
      if (found) {
        console.log(`  ✅ ${exp.name} — existe`);
      } else {
        console.log(`  ⚠️  ${exp.name} — FALTANTE, creando...`);
        await db.collection(col).createIndex(exp.key, { unique: exp.unique, name: exp.name });
        console.log(`  ✅ ${exp.name} — creado`);
        allOk = false;
      }
    }
  }

  console.log(allOk ? '\n✅ Todos los índices OK' : '\n🔧 Índices faltantes creados');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
