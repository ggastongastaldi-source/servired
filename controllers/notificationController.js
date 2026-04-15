const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');

// Enviar FCM push notification
async function sendFCM(fcmToken, title, body, data={}) {
  // Si no hay firebase-admin, usar fetch directo a FCM v1
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
        notification: { title, body, sound: 'default' },
        data
      })
    });
    return response.ok;
  } catch(e) {
    console.error('[FCM] Error:', e.message);
    return false;
  }
}

// Notificar trabajadores cercanos por radio
async function notificarTrabajadoresCercanos(pedido, radioKm=5) {
  try {
    const workers = await Usuario.find({
      rol: 'trabajador',
      verificado: true,
      rubros: pedido.tipoServicio,
      ubicacion: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [pedido.ubicacion?.lng || -58.4, pedido.ubicacion?.lat || -34.6]
          },
          $maxDistance: radioKm * 1000
        }
      }
    }).limit(20);

    console.log(`[notif] ${workers.length} trabajadores en radio ${radioKm}km para ${pedido.tipoServicio}`);

    // Guardar workers notificados
    await Pedido.findByIdAndUpdate(pedido._id, {
      workersNotificados: workers.map(w => w._id)
    });

    for (const w of workers) {
      // Socket.io para online
      if (global.io) {
        global.io.to('worker_' + w._id).emit('nueva_oportunidad', {
          pedidoId: pedido._id,
          rubro: pedido.tipoServicio,
          zona: pedido.zona || 'CABA',
          precio: pedido.precio,
          mensaje: `¡Oportunidad de Oro! 🛠️ Hay demanda de ${pedido.tipoServicio} en ${pedido.zona||'tu zona'}. Valor estimado: $${(pedido.precio||0).toLocaleString('es-AR')}`
        });
      }

      // FCM para offline
      if (w.fcmToken) {
        await sendFCM(
          w.fcmToken,
          '¡Oportunidad de Oro! 🛠️',
          `Hay laburo de ${pedido.tipoServicio} en ${pedido.zona||'tu zona'}. Valor: $${(pedido.precio||0).toLocaleString('es-AR')}. ¡Activate para capturarlo!`,
          { pedidoId: pedido._id.toString(), tipo: 'nueva_oportunidad' }
        );
      }
    }

    return workers.length;
  } catch(e) {
    console.error('[notif] Error:', e.message);
    return 0;
  }
}

// Protocolo de paz mental del cliente
async function notificarCliente(pedidoId, fase) {
  try {
    const pedido = await Pedido.findById(pedidoId).populate('clienteId');
    if (!pedido || !pedido.clienteId) return;

    const mensajes = {
      SEARCHING: {
        titulo: '🔍 Buscando especialista',
        msg: `Activando red de especialistas... Notificamos a los profesionales más cercanos en tu zona.`
      },
      EXPANDING_RADIUS: {
        titulo: '🌎 Ampliando búsqueda',
        msg: `Tu pedido es prioridad. Estamos ampliando el radar a todo el AMBA para asegurarte el servicio hoy.`
      },
      ACEPTADA: {
        titulo: '✅ ¡Especialista asignado!',
        msg: `Tu especialista está en camino. Vas a recibir sus datos en instantes.`
      }
    };

    const m = mensajes[fase];
    if (!m) return;

    // Socket al cliente
    if (global.io) {
      global.io.to('cliente_' + pedido.clienteId._id).emit('estado_pedido', {
        pedidoId, fase,
        titulo: m.titulo,
        mensaje: m.msg
      });
    }

    // FCM al cliente
    if (pedido.clienteId.fcmToken) {
      await sendFCM(pedido.clienteId.fcmToken, m.titulo, m.msg, { pedidoId: pedidoId.toString(), fase });
    }

  } catch(e) {
    console.error('[notif cliente] Error:', e.message);
  }
}

// Flujo completo con expansión de radio
async function iniciarFlujoBusqueda(pedidoId) {
  try {
    const pedido = await Pedido.findByIdAndUpdate(pedidoId, { estado: 'SEARCHING' }, { new: true });
    if (!pedido) return;

    console.log(`[busqueda] Iniciando flujo para pedido ${pedidoId}`);

    // Fase 1 - radio 5km
    await notificarCliente(pedidoId, 'SEARCHING');
    let notif = await notificarTrabajadoresCercanos(pedido, 5);
    console.log(`[busqueda] Fase 1: ${notif} trabajadores notificados`);

    // Esperar 15 minutos y verificar
    setTimeout(async () => {
      const p = await Pedido.findById(pedidoId);
      if (!p || p.estado !== 'SEARCHING') return;

      // Fase 2 - expandir a 30km
      await Pedido.findByIdAndUpdate(pedidoId, { estado: 'EXPANDING_RADIUS' });
      await notificarCliente(pedidoId, 'EXPANDING_RADIUS');
      notif = await notificarTrabajadoresCercanos(p, 30);
      console.log(`[busqueda] Fase 2: ${notif} trabajadores notificados en radio 30km`);

    }, 15 * 60 * 1000); // 15 minutos

  } catch(e) {
    console.error('[busqueda] Error:', e.message);
  }
}

// Broadcast cancelacion a workers cuando pedido es tomado
async function cancelarNotificacionesWorkers(pedidoId, workerAceptoId) {
  try {
    const pedido = await Pedido.findById(pedidoId);
    if (!pedido) return;

    for (const workerId of pedido.workersNotificados || []) {
      if (workerId.toString() === workerAceptoId.toString()) continue;
      if (global.io) {
        global.io.to('worker_' + workerId).emit('pedido_tomado', {
          pedidoId,
          mensaje: 'Este pedido ya fue tomado por otro profesional.'
        });
      }
    }
    console.log(`[notif] Broadcast cancelacion enviado a ${(pedido.workersNotificados||[]).length - 1} workers`);
  } catch(e) {
    console.error('[notif cancel] Error:', e.message);
  }
}

module.exports = {
  iniciarFlujoBusqueda,
  notificarCliente,
  notificarTrabajadoresCercanos,
  cancelarNotificacionesWorkers
};
