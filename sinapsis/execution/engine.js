const { enqueue } = require('../../nexus/infrastructure/outbox');

const DECISION_EVENTS = new Set([
  'LeadQualified',
  'LeadRejected',
  'LeadEscalated',
]);

const handlers = {
  LeadQualified: require('./handlers/LeadQualified'),
  LeadRejected:  require('./handlers/LeadRejected'),
  LeadEscalated: require('./handlers/LeadEscalated'),
};

async function execute(event) {
  if (!DECISION_EVENTS.has(event.eventType)) return;

  const handler = handlers[event.eventType];
  if (!handler) return;

  const commands = await handler(event);
  if (!commands?.length) return;

  for (const cmd of commands) {
    await enqueue({
      workflowId:    event.eventId,                              // eventId como workflowId
      logicalStep:   `${cmd.channel}:${cmd.template}`,          // idempotencia fuerte por eventId+canal+template
      channel:       cmd.channel,
      template:      cmd.template,
      payload:       { ...cmd.payload, correlationId: event.correlationId, causationId: event.eventId },
      correlationId: event.correlationId,
    });
    console.log(`[EL] ${event.eventType} → outbox:${cmd.channel}/${cmd.template} | ${event.aggregateId}`);
  }
}

module.exports = { execute };
