const Usuario = require('../models/Usuario');
const { registrarTransaccion } = require('../controllers/finanzasController');
const Pedido = require('../models/Pedido');

const { LRUCache } = require('lru-cache');
const clienteSockets = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 30,
  updateAgeOnGet: true,
  dispose: (value, key) => {
  }
});

module.exports = (io) => {
  io.on('connection', (socket) => {

    // ── CLIENTE se conecta ──────────────────────────────────────
      socket.join(room);
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
    });

    // Cliente asocia pedido a su socket (lo llama después de crear pedido)
    socket.on('registrar_pedido', ({ pedidoId }) => {
      if (pedidoId) {
        clienteSockets.set(pedidoId, socket.id);
        socket.join('pedido_' + pedidoId);
      }
    });

    // ── TRABAJADOR se conecta ───────────────────────────────────
    socket.on('worker_conectado', async ({ userId, rubro, zona, nombre }) => {
      // SECURITY: preferir userId del JWT verificado sobre el que manda el cliente
      const jwtPayload = socket.handshake.auth?.token
        ? (() => { try { return require('jsonwebtoken').verify(socket.handshake.auth.token, process.env.JWT_SECRET || 'servired-2025-cambiar-en-produccion'); } catch(e) { return null; } })()
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
    });

    // ── TRABAJADOR acepta trabajo ───────────────────────────────
    socket.on('aceptar_trabajo', async ({ pedidoId, trabajadorId, trabajadorNombre }) => {
      try {
        // Buscar pedido activo
        const pedido = await Pedido.findOneAndUpdate(
          { _id: pedidoId, estado: 'PENDIENTE' },
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

        // ✅ Notificar al cliente específicamente
        const clienteSocketId = clienteSockets.get(pedidoId);
        const targetRoom = clienteSocketId
          ? 'cliente_' + clienteSocketId
          : 'pedido_' + pedidoId;

        io.to(targetRoom).emit('trabajo_aceptado', {
          pedidoId,
          trabajadorNombre: trabajadorNombre || 'Un profesional',
          mensaje: 'Tu pedido fue aceptado. El profesional está en camino.',
          estado: 'ACEPTADA'
        });
        io.to(targetRoom).emit('estado_pedido', { pedidoId, estado: 'ACEPTADA' });

        // También notificar a otros workers que el pedido ya fue tomado
        io.to('rubro_' + pedido.tipoServicio).emit('pedido_tomado', { pedidoId });
        io.to('zona_' + pedido.zona).emit('pedido_tomado', { pedidoId });

        // Marcar trabajador como ocupado
        if (trabajadorId) {
          await Usuario.findByIdAndUpdate(trabajadorId, { disponible: false }).catch(() => {});
        }

      } catch (e) {
        console.error('[Socket] Error aceptar_trabajo:', e.message);
        socket.emit('trabajo_aceptado_error', { mensaje: e.message });
      }
    });

    // ── GPS: trabajador envía ubicación ────────────────────────
    socket.on('gps_update', async ({ pedidoId, lat, lng, trabajadorId }) => {
      if (!lat || !lng) return;
      if (trabajadorId) {
        await Usuario.findByIdAndUpdate(trabajadorId, {
          'ubicacion.coordinates': [parseFloat(lng), parseFloat(lat)],
          ultimaUbicacion: new Date()
        }).catch(() => {});
      }
      const clienteSocketId = clienteSockets.get(pedidoId);
      const targetRoom = clienteSocketId
        ? 'cliente_' + clienteSocketId
        : 'pedido_' + pedidoId;
      io.to(targetRoom).emit('worker_gps', {
        pedidoId,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        timestamp: Date.now()
      });
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
          decoded = jwt.verify(token, process.env.JWT_SECRET || 'servired-2025-cambiar-en-produccion');
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
      await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null, disponible: false }
      ).catch(() => {});
      // Limpiar clienteSockets si era un cliente
      // LRU TTL limpia sola
    });
  });
};
        }

        // Emisión exclusiva a los interesados en este pedido (Cliente + Trabajador)
        io.to(pedidoId).emit('worker_location_update', { pedidoId, lat, lng, trabajadorId });
        
        console.log(`📡 GPS Room [${pedidoId}]: ${lat}, ${lng}`);
    });
    // Gestión de Salas (Eficiencia de red)
    socket.on('join_pedido', ({ pedidoId }) => {
        if (!pedidoId) return;
        socket.join(pedidoId);
        console.log(`👤 Cliente/Worker unido a Sala: ${pedidoId}`);
    });

    // Ingesta de GPS con Throttling implícito y Broadcast segmentado
    socket.on('gps_update', async ({ pedidoId, lat, lng, trabajadorId }) => {
        if (!lat || !lng || !pedidoId) return;

        // Persistencia (Asincrónica para no bloquear el socket)
        if (trabajadorId) {
            Usuario.findByIdAndUpdate(trabajadorId, {
                'ubicacion.coordinates': [parseFloat(lng), parseFloat(lat)],
                ultimaUbicacion: new Date()
            }).catch(() => {});
        }

        // Emisión de Alta Velocidad a la Room específica
        io.to(pedidoId).emit('worker_location_update', { 
            pedidoId, 
            lat: parseFloat(lat), 
            lng: parseFloat(lng), 
            trabajadorId,
            timestamp: Date.now() 
        });
        
        console.log(`📡 GPS [Room ${pedidoId}]: ${lat}, ${lng}`);
    });
