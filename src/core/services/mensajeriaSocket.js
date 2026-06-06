const Mensaje = require('../models/Mensaje');
module.exports = function(io) {
  io.on('connection', (socket) => {

    socket.on('chat:unirse', ({ salaId, usuarioId, nombre, rol }) => {
      socket.join(salaId);
      socket.data = { usuarioId, nombre, rol, salaActual: salaId };
    });

    socket.on('chat:mensaje', async ({ salaId, ordenId, texto }) => {
      if (!texto?.trim() || !salaId) return;
      try {
        const msg = await Mensaje.create({
          ordenId: ordenId || null, salaId,
          remitente: socket.data.usuarioId,
          remitenteRol: socket.data.rol,
          remitenteNombre: socket.data.nombre,
          texto: texto.trim().substring(0,1000)
        });
        io.to(salaId).emit('chat:nuevoMensaje', {
          _id: msg._id, salaId,
          remitente: socket.data.usuarioId,
          remitenteRol: socket.data.rol,
          remitenteNombre: socket.data.nombre,
          texto: msg.texto, creadoEn: msg.creadoEn
        });
      } catch(e){ socket.emit('chat:error', { msg: e.message }); }
    });

    socket.on('chat:escribiendo',     ({ salaId }) => socket.to(salaId).emit('chat:escribiendo',     { nombre: socket.data.nombre }));
    socket.on('chat:dejoDeEscribir',  ({ salaId }) => socket.to(salaId).emit('chat:dejoDeEscribir',  {}));
    socket.on('disconnect', () => {
      if (socket.data?.salaActual) socket.to(socket.data.salaActual).emit('chat:dejoDeEscribir', {});
    });
  });
};
