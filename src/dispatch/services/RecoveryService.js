const { readOfferEvents } = require('../events/DispatchEventLog');
const { getSharedClient } = require('../config');
function getClient() { return getSharedClient(); }

async function rehydrateOfferState(offerId) {
  try {
    const JobOffer = require('../../models/JobOffer');
    const offer = await JobOffer.findById(offerId).lean();
    if (!offer) {
      console.error('[Recovery] offer not found in Mongo', { offerId });
      return null;
    }

    const events = await readOfferEvents(offerId);

    let status = offer.status;
    let acceptedBy = offer.acceptedBy;
    for (const e of events) {
      if (e.type === 'OFFER_ACCEPTED') { status = 'ACCEPTED'; acceptedBy = e.payload.workerId; }
      if (e.type === 'OFFER_EXPIRED')  { status = 'EXPIRED'; }
    }

    const r = getClient();
    const key = 'state:offer:' + offerId;
    const fields = [
      'status',    status,
      'pedidoId',  offer.pedidoId.toString(),
      'createdAt', new Date(offer.createdAt).getTime().toString(),
    ];
    if (acceptedBy)       fields.push('acceptedBy',    acceptedBy.toString());
    if (status !== 'OPEN') fields.push('terminalState', status);
    await r.hset(key, ...fields);

    console.log('[Recovery] rehydrateOfferState OK', { offerId, status, eventsReplayed: events.length });
    return { offerId, status, eventsReplayed: events.length };

  } catch(err) {
    console.error('[Recovery] rehydrateOfferState ERROR', { offerId, err: err.message });
    return null;
  }
}

module.exports = { rehydrateOfferState };
