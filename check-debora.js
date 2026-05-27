require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const u = await mongoose.connection.db.collection('usuarios').findOne(
    { email: 'debora.rouiller.1@gmail.com' },
    { projection: { nombre:1, disponible:1, isOnline:1, estado:1, socketId:1, rol:1, rubro:1, especialidades:1 } }
  );
  console.log(JSON.stringify(u, null, 2));
  mongoose.disconnect();
});
