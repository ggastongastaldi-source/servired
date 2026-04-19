const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');

// Buscar workers disponibles (versión flexible)

// Configuración de expansión
const CONFIG = {
  RADIO_INICIAL_KM: 5,
  RADIO_MAXIMO_KM: 50,
  INTERVALO_EXPANSION_MS: 30000, // 30 segundos
  INCREMENTO_PRESUPUESTO_PCT: 10
};

// Mapa de timers activos (para cleanup)
const flujosActivos = new Map();

async function iniciarFlujoBusqueda(pedidoId) {
  try {
    const pedido = await Pedido.findById(pedidoId).populate('cliente');
    if (!pedido) return;

    console.log(`[FSM] Pedido ${pedidoId} iniciado: ${pedido.tipoServicio} en ${pedido.zona}`);
    
    // Fase 1: SEARCHING
    await actualizarEstadoPedido(pedidoId, 'SEARCHING');
    notificarCliente(pedido, 'SEARCHING', 'Buscando especialistas', 'Activando red en tu zona...');
    
    const radioInicial = CONFIG.RADIO_INICIAL_KM;
    const workersFase1 = await buscarWorkersDisponibles(pedido.tipoServicio, pedido.zona, radioInicial);
    
    if (workersFase1.length > 0) {
      await notificarWorkers(pedido, workersFase1);
      console.log(`[FSM] ${workersFase1.length} workers notificados en fase 1`);
      return; // Éxito, no necesitamos expandir
    }
    
    // Fase 2: EXPANDING_RADIUS
    console.log(`[FSM] Sin workers en ${radioInicial}km, iniciando expansión...`);
    await actualizarEstadoPedido(pedidoId, 'EXPANDING_RADIUS');
    notificarCliente(pedido, 'EXPANDING_RADIUS', 'Ampliando búsqueda', 'Buscando en zonas aledañas...');
    
    // Iniciar timer de expansión
    const timerId = setInterval(async () => {
      await ejecutarExpansion(pedidoId);
    }, CONFIG.INTERVALO_EXPANSION_MS);
    
    flujosActivos.set(pedidoId, { timerId, intentos: 1, radioActual: radioInicial });
    
    // Guardar referencia para cleanup
    await Pedido.findByIdAndUpdate(pedidoId, { 
      'metadata.flujoId': pedidoId,
      'metadata.inicioExpansion': new Date()
    });
    
  } catch (error) {
    console.error(`[FSM] Error: `, error);
  }
}

async function ejecutarExpansion(pedidoId) {
  const flujo = flujosActivos.get(pedidoId);
  if (!flujo) return; // Ya fue aceptado o cancelado
  
  const pedido = await Pedido.findById(pedidoId).populate('cliente');
  if (!pedido || pedido.estado === 'ACEPTADA') {
    detenerFlujo(pedidoId);
    return;
  }
  
  flujo.intentos++;
  flujo.radioActual = Math.min(
    CONFIG.RADIO_MAXIMO_KM, 
    flujo.radioActual * 1.5 // Multiplicador de expansión
  );
  
  console.log(`[FSM] Expansión #${flujo.intentos}: ${flujo.radioActual.toFixed(1)}km`);
  
  // Buscar nuevos workers en radio ampliado
  const nuevosWorkers = await buscarWorkersDisponibles(
    pedido.tipoServicio, 
    pedido.zona, 
    flujo.radioActual,
    pedido.workersNotificados // Excluir ya notificados
  );
  
  if (nuevosWorkers.length > 0) {
    // Ofrecer al cliente aumentar presupuesto
    if (flujo.intentos >= 2) {
      ofrecerAumentoPresupuesto(pedido);
    }
    
    await notificarWorkers(pedido, nuevosWorkers);
    notificarCliente(pedido, 'EXPANDING_RADIUS', 'Especialistas encontrados', `${nuevosWorkers.length} trabajadores en ${flujo.radioActual.toFixed(0)}km`);
  } else if (flujo.radioActual >= CONFIG.RADIO_MAXIMO_KM) {
    // Último intento, notificar trabajadores offline
    notificarWorkersOffline(pedido);
    notificarCliente(pedido, 'SIN_WORKERS', 'Búsqueda finalizada', 'No encontramos especialistas disponibles ahora');
    detenerFlujo(pedidoId);
  }
}

async function ofrecerAumentoPresupuesto(pedido) {
  const nuevoTotal = Math.round(pedido.total_estimado * 1.10);
  const io = global.io;
  io.to(`pedido_${pedido._id}`).emit('oferta_aumento', {
    pedidoId: pedido._id,
    presupuestoActual: pedido.total_estimado,
    presupuestoNuevo: nuevoTotal,
    mensaje: '¿Querés sumar 10% para priorizar tu pedido?'
  });
  console.log(`[FSM] Ofreciendo +10% al cliente: ${nuevoTotal}`);
}

async function notificarWorkersOffline(pedido) {
  // Buscar workers del rubro que NO estén online
  const workersOffline = await Usuario.find({
    rol: { \$in: ['TRABAJADOR', 'WORKER'] },
    rubro: { \$regex: pedido.tipoServicio, \$options: 'i' },
    \$or: [
      { isOnline: false },
      { socketStatus: { \$ne: 'online' } },
      { disponible: false }
    ]
  }).limit(10);
  
  // Guardar notificaciones pendientes (para push/mail)
  for (const worker of workersOffline) {
    await Usuario.findByIdAndUpdate(worker._id, {
      \$push: {
        notificacionesPendientes: {
          tipo: 'oportunidad',
          pedidoId: pedido._id,
          mensaje: `Tenés una oportunidad: ${pedido.tipoServicio} - \${pedido.total_estimado}`,
          fecha: new Date(),
          expira: new Date(Date.now() + 3600000) // 1 hora
        }
      }
    });
  }
  
  console.log(`[FSM] ${workersOffline.length} workers offline notificados (pendientes)`);
}

function detenerFlujo(pedidoId) {
  const flujo = flujosActivos.get(pedidoId);
  if (flujo) {
    clearInterval(flujo.timerId);
    flujosActivos.delete(pedidoId);
    console.log(`[FSM] Flujo detenido: ${pedidoId}`);
  }
}

async function actualizarEstadoPedido(pedidoId, estado) {
  await Pedido.findByIdAndUpdate(pedidoId, {
    estado,
    \$push: { historialEstados: { estado, fecha: new Date() } }
  });
}

function notificarCliente(pedido, fase, titulo, mensaje) {
  const io = global.io;
  if (!io) return;
  
  io.to(`pedido_${pedido._id}`).emit('estado_pedido', {
    pedidoId: pedido._id,
    fase,
    titulo,
    mensaje,
    timestamp: new Date().toISOString()
  });
}

async function notificarWorkers(pedido, workers) {
  const io = global.io;
  if (!io) return;
  
  // BATCH: Un solo emit a las salas del rubro y zona
  io.to('rubro_' + pedido.tipoServicio).to('zona_' + pedido.zona).emit('nueva_oportunidad', {
    pedidoId: pedido._id,
    tipoServicio: pedido.tipoServicio,
    zona: pedido.zona,
    precio: pedido.total_estimado,
    pagoWorker: pedido.pago_worker,
    descripcion: pedido.descripcion,
    direccion: pedido.direccion,
    expiraEn: 300
  });
  
  // Marcar todos como notificados en una sola query
  const workerIds = workers.map(w => w._id);
  await Pedido.findByIdAndUpdate(pedido._id, {
    $addToSet: { workersNotificados: { $each: workerIds } }
  });
  
  console.log('[FSM] Batch emit a rubro_' + pedido.tipoServicio + ' + zona_' + pedido.zona + ' (' + workers.length + ' workers)');
}

async function buscarWorkersDisponibles(rubro, zona, lat, lng) {
    console.log(`[BUSCAR] Rubro: ${rubro} | Zona: ${zona} | Ubicación: ${lat},${lng}`);
    
    // Normalizar rubro (todo a minúscula, sin espacios)
    const rubroNormalizado = (rubro || '').toString().toLowerCase().trim();
    
    console.log(`[BUSCAR] Rubro normalizado: ${rubroNormalizado}`);
    
    // Buscar TODOS los workers online del rubro (sin filtro GPS por ahora)
    const workers = await Usuario.find({
        rol: { \$in: ['TRABAJADOR', 'WORKER'] },
        
        rubro: { $regex: rubroNormalizado, $options: 'i' } // Búsqueda flexible
    });
    
    console.log(`[BUSCAR] Workers encontrados: ${workers.length}`);
    workers.forEach(w => console.log(`   - ${w.nombre} (${w.rubro})`));
    
    return workers;
}

// Iniciar flujo de búsqueda
async function iniciarFlujoBusqueda(pedidoId) {
    try {
        const pedido = await Pedido.findById(pedidoId).populate('cliente');
        if (!pedido) return;
        
        console.log(`[FLUJO] Pedido ${pedidoId} - ${pedido.tipoServicio} en ${pedido.zona}`);
        
        // Buscar workers
        const workers = await buscarWorkersDisponibles(
            pedido.tipoServicio,
            pedido.zona,
            pedido.ubicacion?.coordinates?.[1],
            pedido.ubicacion?.coordinates?.[0]
        );
        
        if (workers.length === 0) {
            console.log(`[FLUJO] ❌ No hay workers disponibles`);
            
            // Notificar al cliente que no hay nadie
            const io = global.io;
            if (io) {
                io.to('pedido_' + pedido._id).emit('estado_pedido', {
                    fase: 'SIN_WORKERS',
                    titulo: 'Sin especialistas disponibles',
                    mensaje: 'No hay trabajadores de este rubro conectados ahora'
                });
            }
            return;
        }
        
        // Notificar a cada worker
        const io = global.io;
        let notificados = 0;
        
        for (const worker of workers) {
            // Enviar por socket si está conectado
            io.to('worker_' + worker._id).emit('nueva_oportunidad', {
                pedidoId: pedido._id,
                tipoServicio: pedido.tipoServicio,
                rubro: pedido.tipoServicio,
                zona: pedido.zona,
                precio: pedido.total_estimado,
                pagoWorker: pedido.pago_worker,
                descripcion: pedido.descripcion,
                direccion: pedido.direccion,
                expiraEn: 300
            });
            notificados++;
            
            // Guardar que fue notificado
            await Pedido.findByIdAndUpdate(pedidoId, {
                $addToSet: { workersNotificados: worker._id }
            });
        }
        
        console.log(`[FLUJO] ✅ Notificados ${notificados} workers`);
        
        // Actualizar estado del pedido
        await Pedido.findByIdAndUpdate(pedidoId, { estado: 'SEARCHING' });
        
        // Notificar al cliente
        io.to('pedido_' + pedido._id).emit('estado_pedido', {
            fase: 'SEARCHING',
            titulo: 'Buscando especialista',
            mensaje: `Hay ${notificados} trabajadores disponibles`
        });
        
    } catch (error) {
        console.error(`[FLUJO] Error:`, error);
    }
}

// Aceptar trabajo
async function aceptarTrabajo(pedidoId, workerId) {
    try {
        const pedido = await Pedido.findById(pedidoId);
        if (!pedido) return { ok: false, error: 'Pedido no existe' };
        
        if (pedido.estado === 'ACEPTADO') {
            return { ok: false, error: 'Ya fue tomado por otro' };
        }
        
        pedido.worker = workerId;
        pedido.estado = 'ACEPTADO';
        await pedido.save();
        
        // CRÍTICO: Detener expansión si estaba en curso
        detenerFlujo(pedidoId);
        
        // Notificar al cliente
        const io = global.io;
        // Notificar a todos los workers del rubro/zona que el pedido ya fue tomado
        io.to('rubro_' + pedido.tipoServicio).emit('pedido_tomado', { pedidoId: pedido._id });
        io.to('zona_' + pedido.zona).emit('pedido_tomado', { pedidoId: pedido._id });
        
        io.to('pedido_' + pedido._id).emit('trabajo_aceptado', {
            pedidoId: pedido._id,
            mensaje: '¡Tu pedido fue aceptado!'
        });
        
        return { ok: true, pedido };
        
    } catch (error) {
        return { ok: false, error: error.message };
    }
}


// Cancelar notificaciones pendientes (cuando cliente cancela pedido)
async function cancelarNotificacionesWorkers(pedidoId, io) {
    try {
        // CRÍTICO: Detener timer de expansión si está corriendo
        detenerFlujo(pedidoId);
        
        const pedido = await Pedido.findById(pedidoId);
        if (!pedido) return;
        
        // Notificar a workers que el pedido fue cancelado
        if (io || global.io) {
            const socketIo = io || global.io;
            socketIo.to('rubro_' + pedido.tipoServicio).emit('pedido_cancelado', { pedidoId });
            socketIo.to('zona_' + pedido.zona).emit('pedido_cancelado', { pedidoId });
        }
        
        // Limpiar notificaciones pendientes de workers offline
        await Usuario.updateMany(
            { 'notificacionesPendientes.pedidoId': pedidoId },
            { $pull: { notificacionesPendientes: { pedidoId } } }
        );
        
        console.log(`[FSM] Notificaciones canceladas para pedido: ${pedidoId}`);
    } catch (error) {
        console.error('[FSM] Error cancelando notificaciones:', error);
    }
}


module.exports = {
    detenerFlujo,
    cancelarNotificacionesWorkers, 
    iniciarFlujoBusqueda, 
    aceptarTrabajo,
    buscarWorkersDisponibles 
};
