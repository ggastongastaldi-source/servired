const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://ggastonnet_db_user:servired2024@cluster0.fjqkqhf.mongodb.net/servired?retryWrites=true&w=majority';

const PerfilSchema = new mongoose.Schema({
  nombre: String, email: String, especialidades: [String],
  estado: String, verificado: Boolean, bio: String,
  tarifaHora: Number, trabajosCompletados: Number, rating: Number,
  ultimaActividad: Date,
  ubicacion: { type: { type: String, default: 'Point' }, coordinates: [Number] },
});

const Perfil = mongoose.model('PerfilTrabajador', PerfilSchema);

const trabajadores = [
  { nombre: 'Carlos Méndez', email: 'carlos.mendez@servired.com', especialidades: ['plomeria','albanileria'], estado: 'ACTIVO', verificado: true, bio: 'Plomero con 10 años en CABA, urgencias 24hs.', tarifaHora: 4500, trabajosCompletados: 45, rating: 4.8, ultimaActividad: new Date(), ubicacion: { type: 'Point', coordinates: [-58.4370, -34.6083] } },
  { nombre: 'Roberto Silva', email: 'roberto.silva@servired.com', especialidades: ['electricidad','aire_acondicionado'], estado: 'ACTIVO', verificado: true, bio: 'Electricista matriculado GBA Oeste.', tarifaHora: 5000, trabajosCompletados: 32, rating: 4.6, ultimaActividad: new Date(Date.now()-86400000), ubicacion: { type: 'Point', coordinates: [-58.6500, -34.6600] } },
  { nombre: 'Diego Torres', email: 'diego.torres@servired.com', especialidades: ['gasista','plomeria'], estado: 'ACTIVO', verificado: true, bio: 'Gasista matriculado, presupuesto sin cargo.', tarifaHora: 5500, trabajosCompletados: 22, rating: 4.5, ultimaActividad: new Date(Date.now()-2*86400000), ubicacion: { type: 'Point', coordinates: [-58.5800, -34.7200] } },
  { nombre: 'Marcelo Ruiz', email: 'marcelo.ruiz@servired.com', especialidades: ['pintura','albanileria','durlock'], estado: 'ACTIVO', verificado: false, bio: 'Pintor y albañil GBA Sur.', tarifaHora: 3500, trabajosCompletados: 8, rating: 4.1, ultimaActividad: new Date(Date.now()-5*86400000), ubicacion: { type: 'Point', coordinates: [-58.4000, -34.7800] } },
  { nombre: 'Fabián Gómez', email: 'fabian.gomez@servired.com', especialidades: ['cerrajeria','herreria'], estado: 'ACTIVO', verificado: true, bio: 'Cerrajero urgencias 24hs, GBA Norte.', tarifaHora: 4000, trabajosCompletados: 17, rating: 4.3, ultimaActividad: new Date(Date.now()-3*86400000), ubicacion: { type: 'Point', coordinates: [-58.5300, -34.4700] } },
];

async function seed() {
  await mongoose.connect(MONGO_URI, { family: 4 });
  console.log('✅ Conectado');
  await Perfil.deleteMany({});
  const ins = await Perfil.insertMany(trabajadores);
  console.log(`✅ ${ins.length} trabajadores insertados`);
  ins.forEach(t => console.log(`   - ${t.nombre} | ${t.especialidades.join(', ')}`));
  await mongoose.disconnect();
}

seed().catch(e => { console.error('❌', e.message); process.exit(1); });
