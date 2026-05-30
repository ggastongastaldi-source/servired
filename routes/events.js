const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI);
let col;

async function getCollection() {
  if (!col) {
    await client.connect();
    col = client.db('sinapsis').collection('events');
  }
  return col;
}

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (!body.eventId || !body.correlationId || !body.eventType) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: eventId, correlationId, eventType' });
    }

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

    const col = await getCollection();
    await col.insertOne(doc);

    console.log(`[SINAPSIS] ${doc.eventType} | ${doc.aggregateId} | ${doc.correlationId}`);
    res.json({ ok: true, eventId: doc.eventId });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Evento duplicado', eventId: req.body.eventId });
    }
    console.error('[SINAPSIS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
