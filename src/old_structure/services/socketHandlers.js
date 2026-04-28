const Usuario = require('../models/Usuario');

// ── GPS HELPER — fuente única de verdad ──────────────────
function emitWorkerGPS(io, targetRoom, pedidoId, payload) {
  io.to(targetRoom).emit('worker_gps', payload);
  if (pedidoId) io.to('pedido_' + pedidoId).emit('worker_gps', payload);
  io.to('admins').emit('worker_gps', payload);
  io.emit('worker_gps_broadcast', payload);
}

const { registrarTransaccion } = require('../controllers/finanzasController');
const Pedido = require('../models/Pedido');

const { LRUCache } = require('lru-cache');
const clienteSockets = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 30,
  updateAgeOnGet: true,
  dispose: (value, key) => {
    console.log('[LRU] Expirado:', key);
  }
});

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('[Socket] Conectado:', socket.id);

    // ── CLIENTE se conecta ──────────────────────────────────────
    socket.on('admin_conectado', ({ token }) => {
      socket.join('admins');
      console.log('[Socket] Admin conectado:', socket.id);
    });

    socket.on('join_room', ({ room }) => {
      socket.join(room);
      console.log('[Socket] join_room:', room);
    });

    socket.on('cliente_conectado', async ({ token, userId, pedidoId }) => {
      // Room por userId si existe, fallback por socket.id
      const clienteRoom = userId ? 'cliente_' + userId : 'cliente_' + socket.id;
      socket.join(clienteRoom);
      // Si viene con pedidoId, lo asociamos para notificarle después
      if (pedidoId) clienteSockets.set(pedidoId, socket.id);
      // Si viene con userId, guardar socketId en DB
      const safeUserId = userId;
      if (safeUserId) {
        await Usuario.findByIdAndUpdate(safeUserId, { socketId: socket.id }).catch(() => {});
      }
      socket.emit('conectado_ok', { socketId: socket.id });
      console.log('[Socket] Cliente conectado:', socket.id, pedidoId ? `pedido:${pedidoId}` : '');
    });

    // Cliente asocia pedido a su socket (lo llama después de crear pedido)
    socket.on('registrar_pedido', ({ pedidoId }) => {
      if (pedidoId) {
        clienteSockets.set(pedidoId, socket.id);
        socket.join('pedido_' + pedidoId);
        console.log('[Socket] Cliente registrado en pedido:', pedidoId);
      }
    });

    // ── TRABAJADOR se conecta ───────────────────────────────────
    socket.on('worker_conectado', async ({ userId, rubro, zona, nombre }) => {
      // SECURITY: preferir userId del JWT verificado sobre el que manda el cliente
      const jwtPayload = socket.handshake.auth?.token
        ? (() => { try { return require('jsonwebtoken').verify(socket.handshake.auth.token, process.env.JWT_SECRET); } catch(e) { return null; } })()
        : null;
      const safeUserId = (jwtPayload?.id || jwtPayload?.userId || userId);
      socket.join('zona_' + zona);
      socket.join('rubro_' + rubro);
      // Unirse a TODAS las especialidades del JWT
      const jwtEsp = (jwtPayload?.especialidades || []);
      jwtEsp.forEach(esp => socket.join('rubro_' + esp));
      // Room universal para recibir cualquier pedido
      socket.join('workers_disponibles');
      if (safeUserId) socket.join('worker_' + safeUserId);
      // Guardar socketId en DB para poder localizarlo
      if (userId) {
        await Usuario.findByIdAndUpdate(userId, {
          socketId: socket.id,
          disponible: true,
          socketStatus: 'online'
        }).catch(() => {});
      }
      socket.emit('conectado_ok', { socketId: socket.id });
      io.to('admins').emit('worker_online', { nombre, rubro, zona, userId: safeUserId });
      console.log('[Socket] Worker conectado:', nombre || socket.id, `rubro:${rubro} zona:${zona}`);
    });

    // Trabajador cambia estado disponible/ocupado
    socket.on('cambiar_estado', async ({ userId, estado }) => {
      if (userId) {
        await Usuario.findByIdAndUpdate(userId, {
          disponible: estado === 'disponible',
          socketStatus: estado
        }).catch(() => {});
      }
      socket.emit('estado_actualizado', { estado });
      console.log('[Socket] Estado cambiado:', estado, userId);
    });

    // ── TRABAJADOR acepta trabajo ───────────────────────────────
    socket.on('aceptar_trabajo', async ({ pedidoId, trabajadorId, trabajadorNombre }) => {
      try {
        // Buscar pedido activo
        const pedido = await Pedido.findOneAndUpdate(
          { _id: pedidoId, estado: { $in: ['PENDIENTE', 'SEARCHING'] } },
          {
            estado: 'ACEPTADA',
            trabajador: trabajadorId,
            fechaAceptacion: new Date()
          },
          { new: true }
        );

        if (!pedido) {
          socket.emit('trabajo_aceptado_error', { mensaje: 'Pedido no disponible o ya tomado' });
          return;
        }

        // ✅ Confirmar al trabajador
        socket.emit('trabajo_aceptado_ok', {
          pedidoId,
          mensaje: 'Pedido aceptado. Dirigite al cliente.',
          direccion: pedido.direccion,
          descripcion: pedido.descripcion
        });

        // ✅ Notificar al cliente por todas las vías posibles
        const clienteSocketId = clienteSockets.get(pedidoId);
        const payload = {
          pedidoId,
          trabajadorNombre: trabajadorNombre || 'Un profesional',
          mensaje: 'Tu pedido fue aceptado. El profesional está en camino.',
          estado: 'ACEPTADA'
        };
        // Via room del pedido
        io.to('pedido_' + pedidoId).emit('trabajo_aceptado', payload);
        io.to('pedido_' + pedidoId).emit('estado_pedido', { pedidoId, estado: 'ACEPTADA' });
        // Via socket directo del cliente
        if (clienteSocketId) {
          io.to('cliente_' + clienteSocketId).emit('trabajo_aceptado', payload);
        }
        // Via userId del cliente en DB
        if (pedido.cliente) {
          io.to('worker_' + pedido.cliente).emit('trabajo_aceptado', payload);
          const clienteDB = await Usuario.findById(pedido.cliente).lean();
          if (clienteDB?.socketId) {
            io.to(clienteDB.socketId).emit('trabajo_aceptado', payload);
          }
        }

        // También notificar a otros workers que el pedido ya fue tomado
        io.to('rubro_' + pedido.tipoServicio).emit('pedido_tomado', { pedidoId });
        io.to('zona_' + pedido.zona).emit('pedido_tomado', { pedidoId });

        // Marcar trabajador como ocupado
        if (trabajadorId) {
          await Usuario.findByIdAndUpdate(trabajadorId, { disponible: false }).catch(() => {});
        }

        console.log('[Socket] Pedido aceptado:', pedidoId, 'por worker:', trabajadorId);
      } catch (e) {
        console.error('[Socket] Error aceptar_trabajo:', e.message);
        socket.emit('trabajo_aceptado_error', { mensaje: e.message });
      }
    });

    // ── TRABAJADOR avanza estado del pedido ───────────────────────
    socket.on('cambiar_estado_pedido', async ({ pedidoId, estado, token }) => {
      try {
        const estadosValidos = ['EN_PROCESO', 'REALIZADA', 'PAGADA'];
        if (!estadosValidos.includes(estado)) return;
        const pedido = await Pedido.findByIdAndUpdate(pedidoId,
          { estado, ...(estado === 'EN_PROCESO' ? { fechaInicio: new Date() } : {}),
            ...(estado === 'REALIZADA' ? { fechaFin: new Date() } : {}) },
          { new: true }
        );
        if (!pedido) return;
        const payload = { pedidoId, estado };
        io.to('pedido_' + pedidoId).emit('estado_pedido', payload);
        io.to('admins').emit('estado_pedido_admin', payload);
        if (pedido.cliente) {
          const cli = await Usuario.findById(pedido.cliente).lean();
          if (cli?.socketId) io.to(cli.socketId).emit('estado_pedido', payload);
          io.to('worker_' + pedido.cliente).emit('estado_pedido', payload);
        }
        // Logica de pago segun monto
        const UMBRAL_PAGO = 50000;
        const montoPedido = pedido.precio || pedido.total_estimado || 0;
        const comision = Math.round(montoPedido * 0.20);
        const pagoWorker = Math.round(montoPedido * 0.80);

        // Si pasa a REALIZADA, generar link de pago y enviarlo al cliente
        if (estado === 'REALIZADA' && pedido.cliente) {
          try {
            const { crearPreferencia } = require('../services/pagoService');
            const result = await crearPreferencia({
              pedidoId: pedido._id,
              servicio: pedido.tipoServicio || 'Servicio SERVired',
              precio: Math.round(pedido.precio || pedido.total_estimado || 100000),
              clienteEmail: (await Usuario.findById(pedido.cliente).lean())?.email || '',
              workerId: pedido.workerAcepto
            });
            if (result?.init_point) {
              io.to('pedido_' + pedidoId).emit('link_pago', {
                url: result.init_point,
                preference_id: result.preference_id,
                monto: pedido.precio
              });
              if (pedido.cliente) {
                const cli = await Usuario.findById(pedido.cliente).lean();
                if (cli?.socketId) io.to(cli.socketId).emit('link_pago', {
                  url: result.init_point,
                  preference_id: result.preference_id,
                  monto: pedido.precio
                });
              }
              console.log('[Socket] Link MP enviado al cliente:', result.init_point.slice(0,60));
            }
          } catch(mpErr) {
            console.error('[Socket] Error MP:', mpErr.message);
          }
        }
        // Monto bajo umbral: registrar deuda del trabajador (modelo Uber Cash)
        if (estado === 'REALIZADA' && montoPedido <= UMBRAL_PAGO && pedido.workerAcepto) {
          try {
            await Usuario.findByIdAndUpdate(pedido.workerAcepto, {
              $inc: { deudaComision: comision },
              $push: { historialDeuda: {
                pedidoId: pedido._id,
                monto: comision,
                fecha: new Date(),
                estado: 'PENDIENTE'
              }}
            });
            io.to('worker_' + String(pedido.workerAcepto)).emit('deuda_comision', {
              monto: comision,
              mensaje: 'Cobraste 
            console.log('[Socket] Deuda registrada al worker: $'+comision);
          } catch(e) { console.error('[Socket] Error deuda worker:', e.message); }
        }
        console.log('[Socket] Estado pedido:', pedidoId, '->', estado);
      } catch(e) {
        console.error('[Socket] Error cambiar_estado_pedido:', e.message);
      }
    });

    // ── GPS: trabajador envía ubicación ────────────────────────
    socket.on('gps_update', async ({ pedidoId, lat, lng, trabajadorId }) => {
      if (!pedidoId || !lat || !lng) return;

      // Actualizar posición en DB
      if (trabajadorId) {
        await Usuario.findByIdAndUpdate(trabajadorId, {
          'ubicacion.coordinates': [parseFloat(lng), parseFloat(lat)],
          ultimaUbicacion: new Date()
        }).catch(() => {});
      }

      // Enviar al cliente del pedido
      const clienteSocketId = clienteSockets.get(pedidoId);
      const targetRoom = clienteSocketId
        ? 'cliente_' + clienteSocketId
        : 'pedido_' + pedidoId;

      const payload = { pedidoId, trabajadorId, lat: parseFloat(lat), lng: parseFloat(lng), timestamp: Date.now() };
      io.to(targetRoom).emit('worker_gps', payload);
      if (pedidoId) io.to('pedido_' + pedidoId).emit('worker_gps', payload);
      io.to('admins').emit('worker_gps', payload);
      io.emit('worker_gps_broadcast', payload);
    });

    // ── TRABAJADOR termina el trabajo ──────────────────────────
    socket.on('trabajo_completado', async ({ pedidoId, trabajadorId }) => {
      try {
        await Pedido.findByIdAndUpdate(pedidoId, {
          estado: 'REALIZADA',
          fechaRealizacion: new Date()
        });

        const clienteSocketId = clienteSockets.get(pedidoId);
        const targetRoom = clienteSocketId
          ? 'cliente_' + clienteSocketId
          : 'pedido_' + pedidoId;

        io.to(targetRoom).emit('estado_pedido', {
          pedidoId,
          estado: 'REALIZADA',
          mensaje: 'El trabajo fue completado. Por favor confirmá el pago.'
        });

        if (trabajadorId) {
          await Usuario.findByIdAndUpdate(trabajadorId, { disponible: true }).catch(() => {});
        }

        socket.emit('trabajo_completado_ok', { pedidoId });
        
        // REGISTRO FINANCIERO AUTOMÁTICO
        registrarTransaccion(pedidoId);
        console.log('[Socket] Trabajo completado:', pedidoId);
      } catch (e) {
        socket.emit('error', { mensaje: e.message });
      }
    });


    // ── CLIENTE crea pedido via socket ─────────────────────────
    socket.on('nuevo_pedido', async ({ token, servicio, direccion, precio }) => {
      try {
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch(e) {
          socket.emit('pedido_error', { mensaje: 'Token invalido' });
          return;
        }
        const clienteId = decoded.userId || decoded.id;
        const Pedido = require('../models/Pedido');
        const { iniciarFlujoBusqueda } = require('../controllers/notificationController');
        const cliente = await Usuario.findById(clienteId).lean();
        const zona = cliente?.zona || cliente?.zonaCobertura || 'GBA_OESTE';
        const nuevoPedido = new Pedido({
          cliente: clienteId,
          tipoServicio: servicio,
          zona,
          descripcion: '',
          direccion: direccion || '',
          complejidad: 'baja',
          precio: precio || 100000,
          total_estimado: precio || 100000,
          pago_worker: Math.round((precio || 100000) * 0.8),
          estado: 'PENDIENTE',
          ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] },
          fechaCreacion: new Date()
        });
        const pedidoGuardado = await nuevoPedido.save();
        socket.join('pedido_' + pedidoGuardado._id);
        socket.emit('pedido_creado', {
          pedidoId: pedidoGuardado._id,
          mensaje: 'Pedido recibido. Buscando especialistas...'
        });
        console.log('[Socket] nuevo_pedido:', pedidoGuardado._id, servicio, zona);
        setImmediate(() => {
          iniciarFlujoBusqueda(pedidoGuardado._id)
            .catch(e => console.error('[Socket] Error flujo:', e.message));
        });
      } catch(e) {
        console.error('[Socket] Error nuevo_pedido:', e.message);
        socket.emit('pedido_error', { mensaje: e.message });
      }
    });

    // ── CLIENTE cancela pedido via socket ──────────────────────
    socket.on('cancelar_pedido', async ({ pedidoId, token }) => {
      try {
        const { cancelarNotificacionesWorkers } = require('../controllers/notificationController');
        const Pedido = require('../models/Pedido');
        await Pedido.findByIdAndUpdate(pedidoId, { estado: 'CANCELADA' });
        await cancelarNotificacionesWorkers(pedidoId, io);
        socket.emit('pedido_cancelado_ok', { pedidoId });
      } catch(e) {
        console.error('[Socket] Error cancelar_pedido:', e.message);
      }
    });

    // ── DESCONEXIÓN ────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const workerOffline = await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null, disponible: false }
      ).catch(() => {});
      if (workerOffline && workerOffline.rol === 'TRABAJADOR') {
        io.to('admins').emit('worker_offline', { nombre: workerOffline.nombre });
      }
      // Limpiar clienteSockets si era un cliente
      // LRU TTL limpia sola
      console.log('[Socket] Desconectado:', socket.id);
    });
  });
};
+montoPedido.toLocaleString('es-AR')+' en efectivo. Debés 
            console.log('[Socket] Deuda registrada al worker: $'+comision);
          } catch(e) { console.error('[Socket] Error deuda worker:', e.message); }
        }
        console.log('[Socket] Estado pedido:', pedidoId, '->', estado);
      } catch(e) {
        console.error('[Socket] Error cambiar_estado_pedido:', e.message);
      }
    });

    // ── GPS: trabajador envía ubicación ────────────────────────
    socket.on('gps_update', async ({ pedidoId, lat, lng, trabajadorId }) => {
      if (!pedidoId || !lat || !lng) return;

      // Actualizar posición en DB
      if (trabajadorId) {
        await Usuario.findByIdAndUpdate(trabajadorId, {
          'ubicacion.coordinates': [parseFloat(lng), parseFloat(lat)],
          ultimaUbicacion: new Date()
        }).catch(() => {});
      }

      // Enviar al cliente del pedido
      const clienteSocketId = clienteSockets.get(pedidoId);
      const targetRoom = clienteSocketId
        ? 'cliente_' + clienteSocketId
        : 'pedido_' + pedidoId;

      const payload = { pedidoId, trabajadorId, lat: parseFloat(lat), lng: parseFloat(lng), timestamp: Date.now() };
      io.to(targetRoom).emit('worker_gps', payload);
      if (pedidoId) io.to('pedido_' + pedidoId).emit('worker_gps', payload);
      io.to('admins').emit('worker_gps', payload);
      io.emit('worker_gps_broadcast', payload);
    });

    // ── TRABAJADOR termina el trabajo ──────────────────────────
    socket.on('trabajo_completado', async ({ pedidoId, trabajadorId }) => {
      try {
        await Pedido.findByIdAndUpdate(pedidoId, {
          estado: 'REALIZADA',
          fechaRealizacion: new Date()
        });

        const clienteSocketId = clienteSockets.get(pedidoId);
        const targetRoom = clienteSocketId
          ? 'cliente_' + clienteSocketId
          : 'pedido_' + pedidoId;

        io.to(targetRoom).emit('estado_pedido', {
          pedidoId,
          estado: 'REALIZADA',
          mensaje: 'El trabajo fue completado. Por favor confirmá el pago.'
        });

        if (trabajadorId) {
          await Usuario.findByIdAndUpdate(trabajadorId, { disponible: true }).catch(() => {});
        }

        socket.emit('trabajo_completado_ok', { pedidoId });
        
        // REGISTRO FINANCIERO AUTOMÁTICO
        registrarTransaccion(pedidoId);
        console.log('[Socket] Trabajo completado:', pedidoId);
      } catch (e) {
        socket.emit('error', { mensaje: e.message });
      }
    });


    // ── CLIENTE crea pedido via socket ─────────────────────────
    socket.on('nuevo_pedido', async ({ token, servicio, direccion, precio }) => {
      try {
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch(e) {
          socket.emit('pedido_error', { mensaje: 'Token invalido' });
          return;
        }
        const clienteId = decoded.userId || decoded.id;
        const Pedido = require('../models/Pedido');
        const { iniciarFlujoBusqueda } = require('../controllers/notificationController');
        const cliente = await Usuario.findById(clienteId).lean();
        const zona = cliente?.zona || cliente?.zonaCobertura || 'GBA_OESTE';
        const nuevoPedido = new Pedido({
          cliente: clienteId,
          tipoServicio: servicio,
          zona,
          descripcion: '',
          direccion: direccion || '',
          complejidad: 'baja',
          precio: precio || 100000,
          total_estimado: precio || 100000,
          pago_worker: Math.round((precio || 100000) * 0.8),
          estado: 'PENDIENTE',
          ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] },
          fechaCreacion: new Date()
        });
        const pedidoGuardado = await nuevoPedido.save();
        socket.join('pedido_' + pedidoGuardado._id);
        socket.emit('pedido_creado', {
          pedidoId: pedidoGuardado._id,
          mensaje: 'Pedido recibido. Buscando especialistas...'
        });
        console.log('[Socket] nuevo_pedido:', pedidoGuardado._id, servicio, zona);
        setImmediate(() => {
          iniciarFlujoBusqueda(pedidoGuardado._id)
            .catch(e => console.error('[Socket] Error flujo:', e.message));
        });
      } catch(e) {
        console.error('[Socket] Error nuevo_pedido:', e.message);
        socket.emit('pedido_error', { mensaje: e.message });
      }
    });

    // ── CLIENTE cancela pedido via socket ──────────────────────
    socket.on('cancelar_pedido', async ({ pedidoId, token }) => {
      try {
        const { cancelarNotificacionesWorkers } = require('../controllers/notificationController');
        const Pedido = require('../models/Pedido');
        await Pedido.findByIdAndUpdate(pedidoId, { estado: 'CANCELADA' });
        await cancelarNotificacionesWorkers(pedidoId, io);
        socket.emit('pedido_cancelado_ok', { pedidoId });
      } catch(e) {
        console.error('[Socket] Error cancelar_pedido:', e.message);
      }
    });

    // ── DESCONEXIÓN ────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const workerOffline = await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null, disponible: false }
      ).catch(() => {});
      if (workerOffline && workerOffline.rol === 'TRABAJADOR') {
        io.to('admins').emit('worker_offline', { nombre: workerOffline.nombre });
      }
      // Limpiar clienteSockets si era un cliente
      // LRU TTL limpia sola
      console.log('[Socket] Desconectado:', socket.id);
    });
  });
};
+comision.toLocaleString('es-AR')+' de comision a SERVired. Se descontará de tu próximo trabajo.'
            });
            console.log('[Socket] Deuda registrada al worker: $'+comision);
          } catch(e) { console.error('[Socket] Error deuda worker:', e.message); }
        }
        console.log('[Socket] Estado pedido:', pedidoId, '->', estado);
      } catch(e) {
        console.error('[Socket] Error cambiar_estado_pedido:', e.message);
      }
    });

    // ── GPS: trabajador envía ubicación ────────────────────────
    socket.on('gps_update', async ({ pedidoId, lat, lng, trabajadorId }) => {
      if (!pedidoId || !lat || !lng) return;

      // Actualizar posición en DB
      if (trabajadorId) {
        await Usuario.findByIdAndUpdate(trabajadorId, {
          'ubicacion.coordinates': [parseFloat(lng), parseFloat(lat)],
          ultimaUbicacion: new Date()
        }).catch(() => {});
      }

      // Enviar al cliente del pedido
      const clienteSocketId = clienteSockets.get(pedidoId);
      const targetRoom = clienteSocketId
        ? 'cliente_' + clienteSocketId
        : 'pedido_' + pedidoId;

      const payload = { pedidoId, trabajadorId, lat: parseFloat(lat), lng: parseFloat(lng), timestamp: Date.now() };
      io.to(targetRoom).emit('worker_gps', payload);
      if (pedidoId) io.to('pedido_' + pedidoId).emit('worker_gps', payload);
      io.to('admins').emit('worker_gps', payload);
      io.emit('worker_gps_broadcast', payload);
    });

    // ── TRABAJADOR termina el trabajo ──────────────────────────
    socket.on('trabajo_completado', async ({ pedidoId, trabajadorId }) => {
      try {
        await Pedido.findByIdAndUpdate(pedidoId, {
          estado: 'REALIZADA',
          fechaRealizacion: new Date()
        });

        const clienteSocketId = clienteSockets.get(pedidoId);
        const targetRoom = clienteSocketId
          ? 'cliente_' + clienteSocketId
          : 'pedido_' + pedidoId;

        io.to(targetRoom).emit('estado_pedido', {
          pedidoId,
          estado: 'REALIZADA',
          mensaje: 'El trabajo fue completado. Por favor confirmá el pago.'
        });

        if (trabajadorId) {
          await Usuario.findByIdAndUpdate(trabajadorId, { disponible: true }).catch(() => {});
        }

        socket.emit('trabajo_completado_ok', { pedidoId });
        
        // REGISTRO FINANCIERO AUTOMÁTICO
        registrarTransaccion(pedidoId);
        console.log('[Socket] Trabajo completado:', pedidoId);
      } catch (e) {
        socket.emit('error', { mensaje: e.message });
      }
    });


    // ── CLIENTE crea pedido via socket ─────────────────────────
    socket.on('nuevo_pedido', async ({ token, servicio, direccion, precio }) => {
      try {
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch(e) {
          socket.emit('pedido_error', { mensaje: 'Token invalido' });
          return;
        }
        const clienteId = decoded.userId || decoded.id;
        const Pedido = require('../models/Pedido');
        const { iniciarFlujoBusqueda } = require('../controllers/notificationController');
        const cliente = await Usuario.findById(clienteId).lean();
        const zona = cliente?.zona || cliente?.zonaCobertura || 'GBA_OESTE';
        const nuevoPedido = new Pedido({
          cliente: clienteId,
          tipoServicio: servicio,
          zona,
          descripcion: '',
          direccion: direccion || '',
          complejidad: 'baja',
          precio: precio || 100000,
          total_estimado: precio || 100000,
          pago_worker: Math.round((precio || 100000) * 0.8),
          estado: 'PENDIENTE',
          ubicacion: { type: 'Point', coordinates: [-58.4, -34.6] },
          fechaCreacion: new Date()
        });
        const pedidoGuardado = await nuevoPedido.save();
        socket.join('pedido_' + pedidoGuardado._id);
        socket.emit('pedido_creado', {
          pedidoId: pedidoGuardado._id,
          mensaje: 'Pedido recibido. Buscando especialistas...'
        });
        console.log('[Socket] nuevo_pedido:', pedidoGuardado._id, servicio, zona);
        setImmediate(() => {
          iniciarFlujoBusqueda(pedidoGuardado._id)
            .catch(e => console.error('[Socket] Error flujo:', e.message));
        });
      } catch(e) {
        console.error('[Socket] Error nuevo_pedido:', e.message);
        socket.emit('pedido_error', { mensaje: e.message });
      }
    });

    // ── CLIENTE cancela pedido via socket ──────────────────────
    socket.on('cancelar_pedido', async ({ pedidoId, token }) => {
      try {
        const { cancelarNotificacionesWorkers } = require('../controllers/notificationController');
        const Pedido = require('../models/Pedido');
        await Pedido.findByIdAndUpdate(pedidoId, { estado: 'CANCELADA' });
        await cancelarNotificacionesWorkers(pedidoId, io);
        socket.emit('pedido_cancelado_ok', { pedidoId });
      } catch(e) {
        console.error('[Socket] Error cancelar_pedido:', e.message);
      }
    });

    // ── DESCONEXIÓN ────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const workerOffline = await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null, disponible: false }
      ).catch(() => {});
      if (workerOffline && workerOffline.rol === 'TRABAJADOR') {
        io.to('admins').emit('worker_offline', { nombre: workerOffline.nombre });
      }
      // Limpiar clienteSockets si era un cliente
      // LRU TTL limpia sola
      console.log('[Socket] Desconectado:', socket.id);
    });
  });
};
