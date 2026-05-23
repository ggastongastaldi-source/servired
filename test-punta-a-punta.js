// Simulación punta a punta — ServiRed Nexus
require('dotenv').config();
const mongoose = require('mongoose');

async function simular() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Conectado\n');

  const { emitEvent } = require('./nexus/events/emitEvent');
  const pedidoId = new mongoose.Types.ObjectId();
  const workerId = new mongoose.Types.ObjectId();
  const clienteId = new mongoose.Types.ObjectId();

  console.log('📋 Pedido ID:', pedidoId.toString());
  console.log('');

  // 1. Cliente crea pedido
  console.log('1️⃣  JOB_CREATED...');
  emitEvent({ entityType: 'job', type: 'JOB_CREATED', aggregateId: pedidoId,
    payload: { clienteId, rubro: 'plomeria', zona: 'la_matanza', precio: 180000 }});
  await new Promise(r => setTimeout(r, 1000));

  // 2. Worker acepta
  console.log('2️⃣  JOB_ASSIGNED...');
  emitEvent({ entityType: 'job', type: 'JOB_ASSIGNED', aggregateId: pedidoId,
    payload: { workerId, rubro: 'plomeria', zona: 'la_matanza' }});
  await new Promise(r => setTimeout(r, 1000));

  // 3. Trabajo iniciado
  console.log('3️⃣  JOB_STARTED...');
  emitEvent({ entityType: 'job', type: 'JOB_STARTED', aggregateId: pedidoId,
    payload: { workerId, rubro: 'plomeria' }});
  await new Promise(r => setTimeout(r, 1000));

  // 4. Trabajo completado
  console.log('4️⃣  JOB_COMPLETED...');
  emitEvent({ entityType: 'job', type: 'JOB_COMPLETED', aggregateId: pedidoId,
    payload: { workerId, rubro: 'plomeria', zona: 'la_matanza', precio: 180000 }});
  await new Promise(r => setTimeout(r, 1000));

  // 5. Pagado
  console.log('5️⃣  JOB_PAID...');
  emitEvent({ entityType: 'job', type: 'JOB_PAID', aggregateId: pedidoId,
    payload: { precio: 180000, rubro: 'plomeria' }});
  await new Promise(r => setTimeout(r, 2000));

  // Verificar EventStore
  const eventos = await mongoose.connection.collection('events')
    .find({ aggregateId: pedidoId.toString() }).sort({ timestamp: 1 }).toArray();

  console.log('\n📊 RESULTADO EN EVENTSTORE:');
  console.log('   Eventos grabados:', eventos.length);
  eventos.forEach(e => {
    console.log('  ', new Date(e.timestamp).toLocaleTimeString('es-AR'), '→', e.type);
  });

  // Replay Runner
  console.log('\n🔄 Corriendo Replay Runner...');
  const { replay } = require('./nexus/analytics/replayRunner');
  const result = await replay({ verbose: false });
  console.log('   Procesados:', result.procesados, '| Errores:', result.errores);

  // Ver projections
  const proj = await mongoose.connection.collection('proj_jobs')
    .findOne({ aggregateId: pedidoId.toString() });
  console.log('\n📈 PROJECTION:');
  console.log('   Estado:', proj?.estado || 'no encontrado');
  console.log('   Rubro:', proj?.rubro);
  console.log('   Precio:', proj?.precio);

  console.log('\n✅ Simulación completa exitosa');
  process.exit(0);
}

simular().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
