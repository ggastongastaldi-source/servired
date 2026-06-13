const express  = require('express');
const router   = express.Router();
const Referido = require('../models/Referido');
const { router: eventRouter } = require('../../shared/events/router-instance');
const { emitQrScanned } = require('../../shared/events/referral-events');

// GET /api/referidos/resolver?ref=FERRETERIA001
router.get('/resolver', async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.json({ comercio: null });
  try {
    const doc = await Referido.findOneAndUpdate(
      { ref_code: ref.toUpperCase(), activo: true },
      { $inc: { 'stats.scans': 1 } },
      { new: true }
    );
    if (!doc) return res.json({ comercio: null });

    const response = {
      comercio: { nombre: doc.nombre, zona: doc.zona, tipo: doc.tipo }
    };

    try {
      const evt = emitQrScanned({
        context: { zone: doc.zona, source: 'qr' },
        payload: { ref_code: doc.ref_code }
      });
      const persisted = await eventRouter.publish(evt);
      response.correlation_id = persisted.event.correlation_id;
      response.last_event = {
        event_id: persisted.event.event_id,
        event_type: persisted.event.event_type
      };
    } catch (busErr) {
      console.error('[EventBus] qr_scanned error:', busErr.message);
    }

    res.json(response);
  } catch (e) {
    console.error('[Referidos] resolver:', e.message);
    res.json({ comercio: null });
  }
});

module.exports = router;
