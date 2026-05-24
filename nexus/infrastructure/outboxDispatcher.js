// ServiRed — Outbox Dispatcher Central v1.0
// Conecta el Outbox con los providers reales (email, socket, MP)

const { dispatch, recover } = require('./outbox');
const { execute } = require('./circuitBreaker');

let _io = null;
let _intervalId = null;

function init(io) {
  _io = io;

  // Recovery al arrancar — libera huérfanos
  recover().catch(e => console.error('[Dispatcher] Recovery error:', e.message));

  // Procesar outbox cada 10 segundos
  _intervalId = setInterval(() => {
    _processOutbox().catch(e => console.error('[Dispatcher] Error:', e.message));
  }, 10000);

  // Primer dispatch a los 5 segundos
  setTimeout(() => _processOutbox().catch(() => {}), 5000);

  console.log('[Outbox Dispatcher] ✅ Iniciado — intervalo 10s');
}

async function _processOutbox() {
  const handlers = {
    email: async (template, payload) => {
      await execute('email', async () => {
        const emailService = require('../../src/old_structure/services/emailService');
        if (template === 'bienvenida_worker') {
          await emailService.enviarBienvenidaWorker(payload);
        } else if (template === 'bienvenida_cliente') {
          await emailService.enviarBienvenidaCliente(payload);
        } else if (template === 'invitacion_worker') {
          await emailService.enviarInvitacionWorker(payload);
        } else if (template === 'invitacion_cliente') {
          await emailService.enviarInvitacionCliente(payload);
        }
      });
    },
    socket: async (template, payload) => {
      if (!_io) throw new Error('Socket.IO no disponible');
      const { room, event, data } = payload;
      _io.to(room).emit(event, data);
    },
  };

  await dispatch(handlers);
}

function stop() {
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  console.log('[Outbox Dispatcher] 🛑 Detenido');
}

module.exports = { init, stop };
