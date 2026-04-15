const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');

// Helper: Obtener io de global
const getIO = () => {
  if (!global.io) {
    console.error('[NOTIF] ERROR: global.io no definido. ¿Server.js iniciado?');
    return null;
  }
  return global.io;
};

// Enviar notificación FCM (Firebase Cloud Messaging)
async function sendFCM(fcmToken, title, body, data = {}) {
  if (!fcmToken || !process.env.FCM_SERVER_KEY) return false;
  
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + process.env.FCM_SERVER_KEY
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: { 
          title, 
          body, 
          sound: 'default',
          badge: '1'
        },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        priority: 'high'
      })
    });
    return response.ok;
  } catch(e) {
    console.error('[FCM] Error:', e.message);
    return false;
  }
}

// BUSCAR Y NOTIFICAR TRABAJADORES CERCANOS
async function notificarTrabajadoresCercanos(pedido, radioKm = 5) {
  const io = getIO();
  if (!io) return 0;

  try {
    // Buscar workers online del mismo rubro, ordenados por cercanía
    const workers = await Usuario.find({
      rol: 'WORKER',
      verificado: true,
      isOnline: true,
      rubro: pedido.tipoServicio,
      ubicacion: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: pedido.ubicacion?.coordinates || [-58.4, -34.6]
          },
          $maxDistance: radioKm * 1000 // metros
        }
      }
    }).limit(20);

    console.log(`[NOTIF] ${workers.length} workers ${pedido.tipoServicio} en ${radioKm}km`);

    // Guardar lista de notificados
    await Pedido.findByIdAndUpdate(pedido._id, {
      workersNotificados: workers.map(w => w._id)
    });

    const notificacion = {
      tipo: 'nueva_oportunidad',
      pedidoId: pedido._id.toString(),
      rubro: pedido.tipoServicio,
      zona: pedido.zona,
      descripcion: pedido.descripcion || 'Sin descripción',
      precio: pedido.total_estimado || pedido.precio,
      fecha: new Date().toISOString()
    };

    // Enviar a cada worker
    for (const worker of workers) {
      // 1. Socket.IO (tiempo real - si está conectado)
      io.to(`worker_${worker._id}`).emit('nueva_oportunidad', notificacion);
      io.to(`rubro_${pedido.tipoServicio}`).emit('nueva_oportunidad', notificacion);
      
      // 2. FCM (push notification - si la app está cerrada)
      if (worker.fcmToken) {
        await sendFCM(
          worker.fcmToken,
          `🔔 ¡Nuevo trabajo! ${pedido.tipoServicio.toUpperCase()}`,
          `${pedido.zona} - $${(pedido.total_estimado || 0).toLocaleString('es-AR')}. ¡Sé el primero!`,
          { pedidoId: pedido._id.toString(), tipo: 'nueva_oportunidad', rubro: pedido.tipoServicio }
        );
      }
    }

    return workers.length;
  } catch(e) {
    console.error('[NOTIF] Error buscando workers:', e.message);
    return 0;
  }
}

// NOTIFICAR AL CLIENTE (protocolo de "paz mental")
async function notificarCliente(pedidoId, fase) {
  const io = getIO();
  
  try {
    const pedido = await Pedido.findById(pedidoId).populate('cliente');
    if (!pedido || !pedido.cliente) return;

    const mensajes = {
      SEARCHING: {
        titulo: '🔍 Buscando especialista',
        mensaje: `Activando red de ${pedido.tipoServicio}s cercanos... Te avisamos en segundos.`,
        color: '#FF9800'
      },
      EXPANDING_RADIUS: {
        titulo: '🌎 Ampliando búsqueda',
        mensaje: `Tu pedido es prioridad. Ampliando a toda la zona para conseguirte ${pedido.tipoServicio} YA.`,
        color: '#2196F3'
      },
      ACEPTADA: {
        titulo: '✅ ¡Especialista asignado!',
        mensaje: `Tu ${pedido.tipoServicio} está confirmado. Preparate, va en camino.`,
        color: '#4CAF50'
      }
    };

    const msg = mensajes[fase];
    if (!msg) return;

    const payload = {
      fase,
      pedidoId: pedidoId.toString(),
      ...msg,
      timestamp: new Date().toISOString()
    };

    // Socket al cliente
    if (io) {
      io.to(`cliente_${pedido.cliente._id}`).emit('estado_pedido', payload);
    }

    // FCM al cliente
    if (pedido.cliente.fcmToken) {
      await sendFCM(
        pedido.cliente.fcmToken,
        msg.titulo,
        msg.mensaje,
        { pedidoId: pedidoId.toString(), fase, tipo: 'estado_cliente' }
      );
    }

    console.log(`[NOTIF] Cliente ${pedido.cliente._id} notificado: ${fase}`);

  } catch(e) {
    console.error('[NOTIF] Error notificando cliente:', e.message);
  }
}

// FLUJO COMPLETO DE BÚSQUEDA
async function iniciarFlujoBusqueda(pedidoId) {
  try {
    const pedido = await Pedido.findByIdAndUpdate(
      pedidoId, 
      { 
        estado: 'SEARCHING',
        $push: { historialEstados: { estado: 'SEARCHING', fecha: new Date() } }
      }, 
      { new: true }
    );

    if (!pedido) {
      console.error('[FLUJO] Pedido no encontrado:', pedidoId);
      return;
    }

    console.log(`[FLUJO] ===== INICIANDO BÚSQUEDA =====`);
    console.log(`[FLUJO] Pedido: ${pedidoId}`);
    console.log(`[FLUJO] Servicio: ${pedido.tipoServicio} | Zona: ${pedido.zona}`);

    // FASE 1: Notificar cliente que estamos buscando
    await notificarCliente(pedidoId, 'SEARCHING');

    // FASE 1: Buscar en 5km
    const notificados = await notificarTrabajadoresCercanos(pedido, 5);
    
    if (notificados === 0) {
      console.log('[FLUJO] Sin workers en 5km, expandiendo...');
      expandirBusqueda(pedidoId);
      return;
    }

    console.log(`[FLUJO] Fase 1: ${notificados} workers notificados`);

    // FASE 2: Esperar 2 minutos y expandir si nadie aceptó
    setTimeout(async () => {
      const actual = await Pedido.findById(pedidoId);
      if (actual && actual.estado === 'SEARCHING' && !actual.workerAcepto) {
        console.log(`[FLUJO] Timeout Fase 1 - expandiendo a 30km`);
        expandirBusqueda(pedidoId);
      }
    }, 2 * 60 * 1000); // 2 minutos

  } catch(e) {
    console.error('[FLUJO] Error:', e.message);
  }
}

// EXPANDIR RADIO DE BÚSQUEDA
async function expandirBusqueda(pedidoId) {
  try {
    const pedido = await Pedido.findByIdAndUpdate(
      pedidoId,
      {
        estado: 'EXPANDING_RADIUS',
        $push: { historialEstados: { estado: 'EXPANDING_RADIUS', fecha: new Date() } }
      },
      { new: true }
    );

    if (!pedido) return;

    // Notificar cliente
    await notificarCliente(pedidoId, 'EXPANDING_RADIUS');

    // Buscar en 30km (toda la zona)
    const notificados = await notificarTrabajadoresCercanos(pedido, 30);
    console.log(`[FLUJO] Fase 2: ${notificados} workers notificados en 30km`);

    // Si sigue sin nadie, notificar al admin para asignación manual
    setTimeout(async () => {
      const actual = await Pedido.findById(pedidoId);
      if (actual && actual.estado === 'EXPANDING_RADIUS' && !actual.workerAcepto) {
        const io = getIO();
        if (io) {
          io.to('admins').emit('pedido_sin_asignar', {
            pedidoId: pedidoId.toString(),
            mensaje: `Pedido ${pedido.tipoServicio} en ${pedido.zona} sin asignar después de 15 min`
          });
        }
      }
    }, 10 * 60 * 1000); // 10 minutos más

  } catch(e) {
    console.error('[FLUJO] Error expandiendo:', e.message);
  }
}

// CANCELAR NOTIFICACIONES (cuando alguien acepta)
async function cancelarNotificacionesWorkers(pedidoId, workerAceptoId) {
  const io = getIO();
  if (!io) return;

  try {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return;

    // Notificar a los que no aceptaron que ya fue tomado
    for (const workerId of (pedido.workersNotificados || [])) {
      if (workerId.toString() === workerAceptoId?.toString()) continue;
      
      io.to(`worker_${workerId}`).emit('pedido_tomado', {
        pedidoId: pedidoId.toString(),
        mensaje: 'Este trabajo ya fue asignado a otro profesional'
      });
    }

    // Notificar al cliente que ya tiene worker
    await notificarCliente(pedidoId, 'ACEPTADA');

    console.log(`[FLUJO] Pedido ${pedidoId} asignado a ${workerAceptoId}`);

  } catch(e) {
    console.error('[FLUJO] Error cancelando notifs:', e.message);
  }
}

// WORKER ACEPTA TRABAJO (llamado desde socket o HTTP)
async function aceptarTrabajo(pedidoId, workerId) {
  try {
    const pedido = await Pedido.findById(pedidoId);
    
    if (!pedido || pedido.estado !== 'SEARCHING') {
      return { ok: false, error: 'Pedido no disponible o ya asignado' };
    }

    // Verificar que el worker esté en la lista de notificados
    const fueNotificado = pedido.workersNotificados?.some(w => w.toString() === workerId.toString());
    if (!fueNotificado) {
      console.warn(`[ACEPTAR] Worker ${workerId} intentó aceptar sin ser notificado`);
    }

    // Actualizar pedido
    const actualizado = await Pedido.findByIdAndUpdate(
      pedidoId,
      {
        estado: 'ACEPTADA',
        worker: workerId,
        workerAcepto: workerId,
        fechaAceptacion: new Date(),
        $push: { historialEstados: { estado: 'ACEPTADA', fecha: new Date(), nota: `Aceptado por ${workerId}` } }
      },
      { new: true }
    );

    // Cancelar notificaciones a otros
    await cancelarNotificacionesWorkers(pedidoId, workerId);

    return { ok: true, pedido: actualizado };

  } catch(e) {
    console.error('[ACEPTAR] Error:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  iniciarFlujoBusqueda,
  notificarTrabajadoresCercanos,
  notificarCliente,
  cancelarNotificacionesWorkers,
  aceptarTrabajo,
  expandirBusqueda
};
