const Usuario = require('../models/Usuario');
const Cotizacion = require('../models/Cotizacion');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Usuario conectado: ${socket.id}`);

    // Trabajador se registra como online
    socket.on('registrar-trabajador', async (data) => {
      const { userId, rubro, zona } = data;
      await Usuario.findByIdAndUpdate(userId, {
        socketStatus: 'online',
        socketId: socket.id,
        rubro: rubro,
        zona: zona
      });
      socket.join(`zona-${zona}`);
      socket.join(`rubro-${rubro}`);
      console.log(`[Socket] Trabajador ${userId} en zona ${zona}, rubro ${rubro}`);
    });

    // Cliente se registra
    socket.on('registrar-cliente', (data) => {
      socket.join(`cliente-${data.userId}`);
      console.log(`[Socket] Cliente registrado: ${data.userId}`);
    });

    // Trabajador acepta pedido via socket
    socket.on('aceptar-pedido', async (data) => {
      const { pedidoId, trabajadorId } = data;
      const pedido = await Cotizacion.findByIdAndUpdate(
        pedidoId,
        { status: 'asignado', trabajadorId },
        { new: true }
      );
      if (pedido) {
        io.emit(`pedido-${pedidoId}-asignado`, {
          pedidoId,
          trabajadorId,
          mensaje: 'Un profesional ha aceptado tu pedido'
        });
      }
    });

    socket.on('disconnect', async () => {
      await Usuario.findOneAndUpdate(
        { socketId: socket.id },
        { socketStatus: 'offline', socketId: null }
      );
      console.log(`[Socket] Usuario desconectado: ${socket.id}`);
    });
  });
};
