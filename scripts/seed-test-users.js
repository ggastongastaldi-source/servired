#!/usr/bin/env node
// seed-test-users.js — crea/actualiza usuarios de prueba en colección correcta
// Ejecutar: node scripts/seed-test-users.js
// Idempotente — se puede correr N veces sin problema

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

// cargar .env manualmente
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath,'utf8').split('\n').filter(l=>l&&l[0]!=='#').forEach(l=>{
    const i=l.indexOf('='); if(i>0) process.env[l.slice(0,i)]=l.slice(i+1);
  });
}

const TEST_USERS = [
  {
    email:    'debora.rouiller.1@gmail.com',
    password: 'debora2024',
    nombre:   'Débora Rouiller',
    rol:      'TRABAJADOR',
    especialidades: ['servicio_domestico','limpieza_hogar'],
    zona:     'la_matanza',
    estado:   'ACTIVO',
    dispatch: { availability: 'DISPONIBLE', zona: 'la_matanza',
                rubros: ['servicio_domestico','limpieza_hogar'] },
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB conectado');

  const col = mongoose.connection.collection('usuarios');

  for (const user of TEST_USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    const result = await col.findOneAndUpdate(
      { email: user.email },
      { $set: { ...user, password: hash, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ ${user.email} — rol=${user.rol} password="${user.password}" → hash actualizado`);
  }

  // limpiar usuario en colección equivocada si existe
  const usersCol = mongoose.connection.collection('users');
  const cleaned = await usersCol.deleteMany({ 
    email: { $in: TEST_USERS.map(u => u.email) }
  });
  if (cleaned.deletedCount > 0) {
    console.log(`🧹 ${cleaned.deletedCount} usuarios limpiados de colección 'users' (incorrecta)`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Seed completado — usuarios de prueba listos');
  console.log('   debora.rouiller.1@gmail.com / debora2024');
}

main().catch(e => { console.error(e); process.exit(1); });
