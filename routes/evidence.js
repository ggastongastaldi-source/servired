const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

router.post('/', async (req, res) => {
  try {
    const { aggregateId, correlationId, source, rawData } = req.body;

    if (!aggregateId || !source || !rawData) {
      return res.status(400).json({ error: 'Faltan campos: aggregateId, source, rawData' });
    }

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(rawData))
      .digest('hex');

    const doc = {
      evidenceId:    randomUUID(),
      aggregateId,
      correlationId: correlationId ?? null,
      source,
      rawData,
      hash,
      createdAt:     new Date().toISOString()
    };

    const db = mongoose.connection.useDb('sinapsis');
    const col = db.collection('evidence');

    // idempotente por hash — misma evidencia no se duplica
    const existing = await col.findOne({ hash });
    if (existing) {
      return res.json({ ok: true, evidenceId: existing.evidenceId, duplicate: true });
    }

    await col.insertOne(doc);
    console.log(`[EVIDENCE] ${source} | ${aggregateId} | hash: ${hash.slice(0, 8)}...`);
    res.json({ ok: true, evidenceId: doc.evidenceId });

  } catch (err) {
    console.error('[EVIDENCE] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
