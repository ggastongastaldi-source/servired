const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (!body.eventId || !body.correlationId || !body.eventType) {
      return res.status(400).json({ error: 'Faltan campos: eventId, correlationId, eventType' });
    }

    const db = mongoose.connection.useDb('sinapsis');
    const col = db.collection('events');

    const doc = {
      eventId:       body.eventId,
      correlationId: body.correlationId,
      causationId:   body.causationId ?? null,
      aggregateId:   body.aggregateId,
      aggregateType: body.aggregateType ?? 'Lead',
      eventType:     body.eventType,
      timestamp:     body.timestamp ?? new Date().toISOString(),
      payload:       body.payload ?? {},
      metadata: Object.assign({}, body.metadata ?? {}, {
        ingestedAt: new Date().toISOString()
      })
    };

    await col.insertOne(doc);
    console.log(`[SINAPSIS] ${doc.eventType} | ${doc.aggregateId}`);
    res.json({ ok: true, eventId: doc.eventId });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Evento duplicado' });
    }
    console.error('[SINAPSIS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
