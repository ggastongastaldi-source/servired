
const mongoose = require('mongoose');

async function crearIndices() {
  try {
    const db = mongoose.connection;
    
    // Índice compuesto para buscar workers disponibles
    await db.collection('usuarios').createIndex(
      { rol: 1, rubro: 1, isOnline: 1, disponible: 1 },
      { name: 'idx_workers_disponibles' }
    );
    
    // Índice para pedidos por estado y rubro
    await db.collection('pedidos').createIndex(
      { estado: 1, tipoServicio: 1, zona: 1 },
      { name: 'idx_pedidos_busqueda' }
    );
    
    console.log('✅ Índices creados');
    process.exit(0);
  } catch(e) {
    console.error('❌ Error índices:', e);
    process.exit(1);
  }
}

mongoose.connect(process.env.MONGO_URI).then(crearIndices);
