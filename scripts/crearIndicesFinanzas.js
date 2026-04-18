
const mongoose = require('mongoose');

async function crearIndicesFinanzas() {
  try {
    const db = mongoose.connection;
    
    // Índices para Transacciones (analytics veloces)
    await db.collection('transacciones').createIndex(
      { zona: 1, fechaTrabajo: -1 },
      { name: 'idx_zona_fecha' }
    );
    
    await db.collection('transacciones').createIndex(
      { rubro: 1, comisionPlataforma: 1 },
      { name: 'idx_rubro_comision' }
    );
    
    await db.collection('transacciones').createIndex(
      { estadoWorker: 1, fechaTrabajo: 1 },
      { name: 'idx_estado_fecha' }
    );
    
    console.log('✅ Índices de finanzas creados');
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

mongoose.connect(process.env.MONGO_URI).then(crearIndicesFinanzas);
