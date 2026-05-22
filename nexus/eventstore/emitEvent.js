// Emisor central de eventos — usado por el sistema actual en Shadow Mode
// El sistema viejo llama esto sin saber nada de Nexus
const JobEvent = require('./JobEvent');
const LeadEvent = require('./LeadEvent');
const { v4: uuidv4 } = require('uuid');

async function emitJobEvent({ type, pedidoId, actorId, actorType, payload = {}, metadata = {} }) {
  try {
    await JobEvent.create({
      type,
      aggregateId: pedidoId,
      actorId,
      actorType: actorType || 'sistema',
      correlationId: uuidv4(),
      payload,
      metadata: { source: 'shadow-mode', ...metadata }
    });
    console.log('[Nexus] JobEvent emitido:', type, '| pedido:', pedidoId?.toString?.());
  } catch(e) {
    // Shadow mode: nunca romper el flujo principal
    console.error('[Nexus] Error emitiendo JobEvent:', e.message);
  }
}

async function emitLeadEvent({ type, leadId, actorId, actorType, payload = {}, metadata = {} }) {
  try {
    await LeadEvent.create({
      type,
      aggregateId: leadId,
      actorId,
      actorType: actorType || 'sistema',
      correlationId: uuidv4(),
      payload,
      metadata: { source: 'shadow-mode', ...metadata }
    });
    console.log('[Nexus] LeadEvent emitido:', type, '| lead:', leadId?.toString?.());
  } catch(e) {
    console.error('[Nexus] Error emitiendo LeadEvent:', e.message);
  }
}

module.exports = { emitJobEvent, emitLeadEvent };
