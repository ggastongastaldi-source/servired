const { dispatch, recover } = require('./outbox');
const { execute: circuitBreaker } = require('./circuitBreaker');
const { sendEmail } = require('../../sinapsis/adapters/email/resendAdapter');

let _io = null;
let _intervalId = null;

function init(io) {
  _io = io;
  recover().catch(e => console.error('[Dispatcher] Recovery error:', e.message));

  _intervalId = setInterval(() => {
    _processOutbox().catch(e => console.error('[Dispatcher] Error:', e.message));
  }, 10000);

  setTimeout(() => _processOutbox().catch(() => {}), 5000);
  console.log('[Outbox Dispatcher] ✅ Iniciado — intervalo 10s');
}

async function _processOutbox() {
  const handlers = {
    email: async (template, payload) => {
      await circuitBreaker('email', async () => {
        if (template === 'lead_qualified_outreach') {
          await sendEmail({
            to:            payload.to ?? process.env.SINAPSIS_TEST_EMAIL,
            subject:       `Lead calificado — score ${payload.score}`,
            body:          `Lead ${payload.aggregateId} calificado.\nScore: ${payload.score}\nMotivo: ${payload.reason}`,
            correlationId: payload.correlationId,
            aggregateId:   payload.aggregateId
          });
        } else if (template === 'lead_rejected_notify') {
          await sendEmail({
            to:            payload.to ?? process.env.SINAPSIS_TEST_EMAIL,
            subject:       `Lead rechazado — score ${payload.score}`,
            body:          `Lead ${payload.aggregateId} rechazado.\nScore: ${payload.score}\nMotivo: ${payload.reason}`,
            correlationId: payload.correlationId,
            aggregateId:   payload.aggregateId
          });
        } else {
          // templates legacy
          const emailService = require('../../src/old_structure/services/emailService');
          if (template === 'bienvenida_worker')   await emailService.enviarBienvenidaWorker(payload);
          if (template === 'bienvenida_cliente')  await emailService.enviarBienvenidaCliente(payload);
          if (template === 'invitacion_worker')   await emailService.enviarInvitacionWorker(payload);
          if (template === 'invitacion_cliente')  await emailService.enviarInvitacionCliente(payload);
        }
      });
    },
    socket: async (template, payload) => {
      if (!_io) throw new Error('Socket.IO no disponible');
      _io.to(payload.room).emit(payload.event, payload.data);
    },
  };

  await dispatch(handlers);
}

function stop() {
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  console.log('[Outbox Dispatcher] 🛑 Detenido');
}

module.exports = { init, stop };
