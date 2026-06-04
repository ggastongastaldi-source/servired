const JobOffer = require('../../models/JobOffer');
const { incrementZoneLoad, evaluateDispatchStrategy } = require('./AdmissionController');
const { initializeOfferState }  = require('./StateArbitrationEngine');
const { trackDeliveryLatency, incrementDispatchOutcome } = require('./MetricsService');
const { logEvent }  = require('../events/DispatchEventLog');
const { dispatchQueue } = require('../queues/dispatchQueue');
const { ttlQueue }      = require('../queues/ttlQueue');

const OFFER_TTL_MS = 25000;
const RECON_DELAY  =  5000;

async function dispatchPedido(io, pedido) {
  const startTs  = Date.now();
  const pedidoId = pedido._id.toString();
  const zonaId   = pedido.zona || 'default';
  let offerId;

  try {
    await incrementZoneLoad(zonaId);
    const { strategy, load } = await evaluateDispatchStrategy(zonaId);
    console.log('[DispatchService] strategy', { pedidoId, strategy, load });

    const Usuario = require('../../src/old_structure/models/Usuario');
    const workers = await Usuario.find({
      disponible:     true,
      isOnline:       true,
      especialidades: { $in: [pedido.tipoServicio] },
      zona:           zonaId,
    }).select('_id fcmToken nombre').lean();

    if (workers.length === 0) {
      console.log('[DispatchService] no workers', { pedidoId, zonaId });
      await incrementDispatchOutcome('NO_WORKERS');
      return { success: false, reason: 'NO_WORKERS' };
    }

    const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
    const offer = await JobOffer.create({ pedidoId: pedido._id, status: 'OPEN', expiresAt });
    offerId = offer._id.toString();

    await initializeOfferState(offerId, pedidoId);

    const payload = {
      offerId,
      pedidoId,
      tipoServicio: pedido.tipoServicio,
      zona:         zonaId,
      descripcion:  pedido.descripcion || '',
      expiresAt:    expiresAt.toISOString(),
    };

    if (strategy === 'STANDARD') {
      for (const w of workers) {
        io.to('worker_' + w._id.toString()).emit('nueva_oportunidad', payload);
        console.log('[DispatchService] STANDARD emit', { offerId, workerId: w._id });
      }

    } else if (strategy === 'STAGGERED_CONGESTED') {
      for (let i = 0; i < workers.length; i++) {
        const wid = workers[i]._id.toString();
        await dispatchQueue.add(
          'staggered_emit_' + offerId + '_' + wid,
          { workerId: wid, pedidoId, offerId, payload },
          { delay: i * 800 }
        );
      }

    } else {
      // FCM_FIRST_DEGRADED
      for (const w of workers) {
        if (w.fcmToken) {
          try {
            const { sendPushNotification } = require('../../src/old_structure/services/pushService');
            await sendPushNotification(w.fcmToken, {
              title: 'Nuevo trabajo disponible',
              body:  'Hay un pedido esperando tu respuesta',
              data:  { pedidoId, offerId },
            });
            await logEvent('FALLBACK_TRIGGERED', { offerId, workerId: w._id.toString(), pedidoId });
          } catch(fcmErr) {
            console.error('[DispatchService] FCM error', { offerId, err: fcmErr.message });
          }
        }
      }
    }

    // recon_* 5s
    for (const w of workers) {
      await dispatchQueue.add(
        'recon_' + offerId + '_' + w._id.toString(),
        { offerId, workerId: w._id.toString(), pedidoId },
        { delay: RECON_DELAY }
      );
    }

    // ttl_* 25s
    await ttlQueue.add('ttl_' + offerId, { offerId, pedidoId }, { delay: OFFER_TTL_MS });

    const latency = Date.now() - startTs;
    await trackDeliveryLatency(offerId, latency);
    await incrementDispatchOutcome('DISPATCHED_' + strategy);

    console.log('[DispatchService] OK', { offerId, pedidoId, strategy, workers: workers.length, latencyMs: latency });
    return { success: true, offerId, strategy, workersNotified: workers.length };

  } catch(err) {
    console.error('[DispatchService] ERROR', { pedidoId, offerId, err: err.message });
    await incrementDispatchOutcome('ERROR').catch(() => {});
    throw err;
  }
}

module.exports = { dispatchPedido };
