const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const USERS = [
  { email:'gaston@servired.com', password:'admin123', rol:'ADMIN', estado:'ACTIVO' },
  { email:'cliente@servired.com', password:'Test2026ok', rol:'CLIENTE', estado:'ACTIVO' },
  { email:'debora.rouiller.1@gmail.com', password:'debora123', rol:'TRABAJADOR', estado:'VERIFICADO', disponible:true, especialidades:['servicio_domestico','limpieza_hogar'], zona:'la_matanza' },
];
async function assertSystemUsers() {
  const col = mongoose.connection.db.collection('usuarios');
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const ex = await col.findOne({ email: u.email });
    if (!ex) {
      await col.insertOne({ ...u, password: hash, createdAt: new Date() });
      console.log('[assert] ✅ Creado:', u.email);
    } else {
      const valid = await bcrypt.compare(u.password, ex.password||'').catch(()=>false);
      if (!valid) {
        await col.updateOne({ email:u.email }, { $set:{ password:hash, estado:u.estado } });
        console.log('[assert] 🔧 Reparado:', u.email);
      }
    }
  }
}
module.exports = { assertSystemUsers };
