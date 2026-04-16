const Usuario = require('../models/Usuario');
const Cotizacion = require('../models/Cotizacion');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('[Socket] Conectado:', socket.id);

    // Cliente se conecta
    socket.on('cliente_conectado', async (data) => {
      socket.join('cliente-' + socket.id);
      socket.emit('conectado_ok', { socketId: socket.id });
      console.log('[Socket] Cliente conectado:', socket.id);
    });

    // Trabajador se conecta
    socket.on('worker_conectado', async (data) => {
      const { token, rubro, zona, nombre } = data;
      socket.join('zona-' + zona);
      socket.join('rubro-' + rubro);
      socket.emit('conectado_ok', { socketId: socket.id });
      // Guardar socketId si hay userId en token (opcional por ahora)
      console.log('[Socket] Worker conectado:', nombre || socket.id);
    });

    // Trabajador cambia estado disponible/ocupado
    socket.on('cambiar_estado', async (data) => {
      const { userId, estado } = data;
      if (userId) {
        await Usuario.findByIdAndUpdate(userId, { disponible: estado === 'disponible' });
      }
      console.log('[Socket] Estado cambiado:', estado);
    });

    // Trabajador acepta trabajo
    socket.on('aceptar_trabajo', async (data) => {
      const { pedidoId, trabajadorId } = data;
      try {
        const pedido = await Cotizacion.findByIdAndUpdate(
          pedidoId,
          { status: 'asignado', trabajadorId },
          { new: true }
        );
        if (pedido) {
          socket.emit('trabajo_aceptado_ok', { pedidoId, mensaje: 'Pedido aceptado correctamente' });
          // Notificar al cliente
          io.emit('trabajo_aceptado', {
            pedidoId,
            mensaje: 'Un profesional aceptó tu pedido y está en camino'
          });
          io.emit('estado_pedido', { pedidoId, estado: 'asignado' });
        } else {
          socket.emit('trabajo_aceptado_error', { mensaje: 'Pedido no encontrado' });
        }
      } catch (e) {
        socket.emit('trabajo_aceptado_error', { mensaje: e.message });
      }
    });

    socket.on('disconnect', async () => {
      await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null }
      ).catch(() => {});
      console.log('[Socket] Desconectado:', socket.id);
    });
  });
};
