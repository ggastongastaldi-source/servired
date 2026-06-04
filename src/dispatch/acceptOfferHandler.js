const { markOfferAccepted, getOfferState } = require('./services/StateArbitrationEngine');
const { decrementZoneLoad }   = require('./services/AdmissionController');
const { rehydrateOfferState } = require('./services/RecoveryService');
const { logEvent }            = require('./events/DispatchEventLog');
const { incrementDispatchOutcome } = require('./services/MetricsService');

function registerAcceptOffer(io, socket) {
  socket.on('accept_offer', async (data) => {
    const { offerId, workerId, pedidoId, idempotencyKey } = data || {};

    if (!offerId || !workerId) {
      console.error('[acceptOffer] missing params', { offerId, workerId });
      return socket.emit('offer_error', { error: 'MISSING_PARAMS' });
    }

    console.log('[acceptOffer] received', { offerId, workerId, pedidoId });

    try {
      let state = await getOfferState(offerId);
      if (!state || Object.keys(state).length === 0) {
        console.log('[acceptOffer] Redis MISS — rehydrating', { offerId });
        await rehydrateOfferState(offerId);
        state = await getOfferState(offerId);
      }

      if (!state) {
        return socket.emit('offer_error', { offerId, error: 'OFFER_NOT_FOUND' });
      }

      if (state.terminalState) {
        console.log('[acceptOffer] already terminal', { offerId, state: state.terminalState });
        return socket.emit('offer_rejected', { offerId, reason: state.terminalState });
      }

      const result = await markOfferAccepted(offerId, workerId, idempotencyKey);
      if (!result.success) {
        console.log('[acceptOffer] rejected', { offerId, workerId, reason: result.reason });
        return socket.emit('offer_rejected', { offerId, reason: result.reason });
      }

      const JobOffer = require('../models/JobOffer');
      await JobOffer.findByIdAndUpdate(offerId, {
        status:     'ACCEPTED',
        acceptedBy: workerId.toString(),
      });

      if (pedidoId) {
        try {
          const Pedido = require('../../src/old_structure/models/Pedido');
          const pedido = await Pedido.findById(pedidoId).select('zona').lean();
          if (pedido) await decrementZoneLoad(pedido.zona || 'default');
        } catch(e) {
          console.error('[acceptOffer] decrementZoneLoad ERROR', e.message);
        }
      }

      await logEvent('OFFER_ACCEPTED', { offerId, workerId: workerId.toString(), pedidoId });
      await incrementDispatchOutcome('ACCEPTED');

      io.emit('job_offer_taken', { offerId, pedidoId, acceptedBy: workerId.toString() });
      socket.emit('offer_accepted_ok', { offerId, pedidoId });
      console.log('[acceptOffer] OK', { offerId, workerId });

    } catch(err) {
      console.error('[acceptOffer] ERROR', { offerId, workerId, err: err.message });
      socket.emit('offer_error', { offerId, error: 'INTERNAL_ERROR' });
    }
  });
}

module.exports = { registerAcceptOffer };
