const { Queue, Worker } = require('bullmq');
const { createRedisConnection, defaultJobOptions, workerOptions } = require('../config');
const { logEvent } = require('../events/DispatchEventLog');

const dispatchQueue = new Queue('dispatch', {
  connection:        createRedisConnection(),
  defaultJobOptions,
});

function startDispatchWorker(io) {
  const worker = new Worker('dispatch', async (job) => {
    const { name, data } = job;

    if (name.startsWith('staggered_emit')) {
      const { workerId, offerId, payload } = data;
      try {
        io.to('worker_' + workerId).emit('nueva_oportunidad', payload);
        await logEvent('DELIVERY_ACK', { offerId, workerId, pedidoId: data.pedidoId });
        console.log('[DispatchWorker] staggered_emit OK', { offerId, workerId });
      } catch(err) {
        console.error('[DispatchWorker] staggered_emit ERROR', { offerId, workerId, err: err.message });
        throw err;
      }
    }

    if (name.startsWith('recon_')) {
      const { offerId, workerId, pedidoId } = data;
      try {
        const { getOfferState } = require('../services/StateArbitrationEngine');
        const state = await getOfferState(offerId);
        if (!state || state.status === 'OPEN') {
          console.log('[DispatchWorker] recon — no ACK, FCM fallback', { offerId, workerId });
          await logEvent('FALLBACK_TRIGGERED', { offerId, workerId, pedidoId });
          try {
            const Usuario = require('../../src/old_structure/models/Usuario');
            const w = await Usuario.findById(workerId).select('fcmToken').lean();
            if (w && w.fcmToken) {
              const { sendPushNotification } = require('../../src/old_structure/services/pushService');
              await sendPushNotification(w.fcmToken, {
                title: 'Nuevo trabajo disponible',
                body:  'Hay un pedido esperando tu respuesta',
                data:  { pedidoId, offerId },
              });
            }
          } catch(fcmErr) {
            console.error('[DispatchWorker] FCM ERROR', { offerId, err: fcmErr.message });
          }
        }
      } catch(err) {
        console.error('[DispatchWorker] recon ERROR', { offerId, err: err.message });
        throw err;
      }
    }
  }, {
    connection: createRedisConnection(),
    ...workerOptions,
  });

  worker.on('failed', (job, err) => {
    console.error('[DispatchWorker] failed', { jobId: job?.id, name: job?.name, err: err.message });
  });

  return worker;
}

module.exports = { dispatchQueue, startDispatchWorker };
