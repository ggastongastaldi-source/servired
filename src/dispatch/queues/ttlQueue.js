const { Queue, Worker } = require('bullmq');
const { createRedisConnection, defaultJobOptions, workerOptions } = require('../config');
const { markOfferExpired } = require('../services/StateArbitrationEngine');
const { logEvent } = require('../events/DispatchEventLog');

const ttlQueue = new Queue('ttl', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 8,
    backoff:  { type: 'exponential', delay: 2000 },
  },
});

function startTtlWorker() {
  const worker = new Worker('ttl', async (job) => {
    const { offerId, pedidoId } = job.data;
    try {
      const result = await markOfferExpired(offerId);
      if (!result.success) {
        console.log('[TtlWorker] already terminal — skip', { offerId, reason: result.reason });
        return;
      }
      const JobOffer = require('../../models/JobOffer');
      await JobOffer.findByIdAndUpdate(offerId, { status: 'EXPIRED' });
      await logEvent('OFFER_EXPIRED', { offerId, pedidoId });
      console.log('[TtlWorker] expired OK', { offerId, pedidoId });
    } catch(err) {
      console.error('[TtlWorker] ERROR', { offerId, pedidoId, err: err.message });
      throw err;
    }
  }, {
    connection: createRedisConnection(),
    ...workerOptions,
  });

  worker.on('failed', (job, err) => {
    console.error('[TtlWorker] failed', { jobId: job?.id, err: err.message });
  });

  return worker;
}

module.exports = { ttlQueue, startTtlWorker };
