const Usuario = require('../models/Usuario');
const Pedido = require('../models/Pedido');

const LRU = require('lru-cache');
const clienteSockets = new LRU({
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
    socket.on('join_room', ({ room }) => {
      socket.join(room);
      console.log('[Socket] join_room:', room);
    });

    socket.on('cliente_conectado', async ({ token, userId, pedidoId }) => {
      // Room por userId si existe, fallback por socket.id
      const clienteRoom = userId ? 'cliente_' + userId : 'cliente_' + socket.id;
      socket.join(clienteRoom);
      // Si viene con pedidoId, lo asociamos para notificarle después
      if (pedidoId) clienteSockets.get(pedidoId) = socket.id;
      // Si viene con userId, guardar socketId en DB
      if (userId) {
        await Usuario.findByIdAndUpdate(userId, { socketId: socket.id }).catch(() => {});
      }
      socket.emit('conectado_ok', { socketId: socket.id });
      console.log('[Socket] Cliente conectado:', socket.id, pedidoId ? `pedido:${pedidoId}` : '');
    });

    // Cliente asocia pedido a su socket (lo llama después de crear pedido)
    socket.on('registrar_pedido', ({ pedidoId }) => {
      if (pedidoId) {
        clienteSockets.get(pedidoId) = socket.id;
        socket.join('pedido_' + pedidoId);
        console.log('[Socket] Cliente registrado en pedido:', pedidoId);
      }
    });

    // ── TRABAJADOR se conecta ───────────────────────────────────
    socket.on('worker_conectado', async ({ userId, rubro, zona, nombre }) => {
      socket.join('zona_' + zona);
      socket.join('rubro_' + rubro);
      // Guardar socketId en DB para poder localizarlo
      if (userId) {
        await Usuario.findByIdAndUpdate(userId, {
          socketId: socket.id,
          disponible: true,
          socketStatus: 'online'
        }).catch(() => {});
      }
      socket.emit('conectado_ok', { socketId: socket.id });
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

        console.log('[Socket] Pedido aceptado:', pedidoId, 'por worker:', trabajadorId);
      } catch (e) {
        console.error('[Socket] Error aceptar_trabajo:', e.message);
        socket.emit('trabajo_aceptado_error', { mensaje: e.message });
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
        console.log('[Socket] Trabajo completado:', pedidoId);
      } catch (e) {
        socket.emit('error', { mensaje: e.message });
      }
    });

    // ── DESCONEXIÓN ────────────────────────────────────────────
    socket.on('disconnect', async () => {
      await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null, disponible: false }
      ).catch(() => {});
      // Limpiar clienteSockets si era un cliente
      for (const [pid, sid] of Object.entries(clienteSockets)) {
        if (sid === socket.id) delete clienteSockets.get(pid);
      }
      console.log('[Socket] Desconectado:', socket.id);
    });
  });
};
