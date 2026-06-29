const express  = require('express');
const router   = express.Router();
const ZoneState = require('../models/ZoneState');

// GET /api/zones/:zoneId/pressure
router.get('/:zoneId/pressure', async (req, res) => {
  try {
    const zone = await ZoneState.findOne({ zoneId: req.params.zoneId });
    if (!zone) return res.status(404).json({ error: 'zona no encontrada' });
    res.json(zone.toOutput());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/heatmap  (todas las zonas ordenadas por presión)
router.get('/heatmap', async (req, res) => {
  try {
    const zones = await ZoneState.find({}).sort({ marketPressure: -1 });
    res.json(zones.map(z => z.toOutput()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/ranking
router.get('/ranking', async (req, res) => {
  try {
    const zones = await ZoneState.find({ zoneState: 'SHORTAGE' }).sort({ marketPressure: -1 }).limit(10);
    res.json(zones.map(z => z.toOutput()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
