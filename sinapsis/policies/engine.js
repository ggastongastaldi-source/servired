// SINAPSIS — Policy Decision Layer v1.0
// Responsabilidad única: Evento → Política → Evento
// No envía mensajes. No actualiza vistas. Solo emite eventos canónicos.

const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const rules = require('./rules');

async function evaluate(incomingEvent) {
  const matching = rules.filter(r => r.on === incomingEvent.eventType);
  if (!matching.length) return [];

  const db = mongoose.connection.useDb('sinapsis');
  const col = db.collection('events');
  const emitted = [];

  for (const rule of matching) {
    if (!rule.when(incomingEvent.payload)) continue;

    const decisionEvent = {
      eventId:       randomUUID(),
      correlationId: incomingEvent.correlationId,
      causationId:   incomingEvent.eventId,   // trazabilidad causal
      aggregateId:   incomingEvent.aggregateId,
      aggregateType: incomingEvent.aggregateType ?? 'Lead',
      eventType:     rule.emit,
      timestamp:     new Date().toISOString(),
      payload:       rule.buildPayload(incomingEvent),
      metadata: {
        version:    1,
        origin:     'PDL',
        rule:       `${rule.on} → ${rule.emit}`,
        ingestedAt: new Date().toISOString()
      }
    };

    try {
      await col.insertOne(decisionEvent);
      console.log(`[PDL] ${rule.on} → ${rule.emit} | ${incomingEvent.aggregateId}`);
      emitted.push(decisionEvent);
    } catch (e) {
      if (e.code === 11000) {
        console.log(`[PDL] Duplicado ignorado: ${rule.emit} | ${incomingEvent.aggregateId}`);
      } else {
        console.error(`[PDL] Error emitiendo ${rule.emit}:`, e.message);
      }
    }
  }

  return emitted;
}

module.exports = { evaluate };
