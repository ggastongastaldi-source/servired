const express = require('express');
const router  = express.Router();
const { queries, buildZoneGraphContract } = require('../services/economicGraphProjection');

// GET /api/graph/zone/:zoneId?strength=0.1
router.get('/zone/:zoneId', async (req, res) => {
  try {
    const contract = await buildZoneGraphContract(req.params.zoneId, parseFloat(req.query.strength || '0.1'));
    res.json(contract);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/graph/node/:nodeType/:entityId/neighbors?edgeType=SERVICE&zoneId=la_matanza
router.get('/node/:nodeType/:entityId/neighbors', async (req, res) => {
  try {
    const { nodeType, entityId } = req.params;
    const neighbors = await queries.getNeighbors(entityId, nodeType.toUpperCase(), req.query.edgeType || null, req.query.zoneId || null);
    res.json({ nodeId: `${nodeType.toUpperCase()}:${entityId}`, neighbors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/graph/zone/:zoneId/top?nodeType=PROFESSIONAL&limit=10
router.get('/zone/:zoneId/top', async (req, res) => {
  try {
    const nodes = await queries.getTopNodesByZone(req.params.zoneId, (req.query.nodeType || 'PROFESSIONAL').toUpperCase(), parseInt(req.query.limit || '10', 10));
    res.json({ zoneId: req.params.zoneId, nodes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
