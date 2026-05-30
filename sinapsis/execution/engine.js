// SINAPSIS — Execution Layer v1.0
// Responsabilidad única: Decision Event → Outbox.enqueue()
// No llama proveedores. No actualiza vistas. Solo encola comandos.

const { enqueue } = require('../../nexus/infrastructure/outbox');
const handlers = {
  LeadQualified: require('./handlers/LeadQualified'),
  LeadRejected:  require('./handlers/LeadRejected'),
  LeadEscalated: require('./handlers/LeadEscalated'),
};

async function execute(event) {
  const handler = handlers[event.eventType];
  if (!handler) return;

  const commands = await handler(event);
  if (!commands?.length) return;

  for (const cmd of commands) {
    await enqueue({
      workflowId:   event.correlationId,
      logicalStep:  `${event.eventType}:${cmd.channel}:${cmd.template}`,
      channel:      cmd.channel,
      template:     cmd.template,
      payload:      { ...cmd.payload, correlationId: event.correlationId, causationId: event.eventId },
      correlationId: event.correlationId,
    });
    console.log(`[EL] ${event.eventType} → outbox:${cmd.channel}/${cmd.template} | ${event.aggregateId}`);
  }
}

module.exports = { execute };
