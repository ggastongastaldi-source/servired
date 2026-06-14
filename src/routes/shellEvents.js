const express = require('express');
const router = express.Router();
const { router: eventRouter } = require('../../shared/events/router-instance');
const { emitShellOpened } = require('../../shared/events/shell-events');

// POST /api/shell/opened
// Primer productor visual real del Shell (Sprint 2/2.1 dejaron emitShellOpened
// y SessionContext listos, pero sin consumidor hasta hoy).
router.post('/opened', async (req, res) => {
  try {
    const { correlationId, causation } = req.body || {};

    const evt = emitShellOpened({
      correlationId,
      causation,
      context: { source: 'shell' }
    });
    const persisted = await eventRouter.publish(evt);

    res.json({
      ok: true,
      correlation_id: persisted.event.correlation_id,
      last_event: {
        event_id: persisted.event.event_id,
        event_type: persisted.event.event_type
      }
    });
  } catch (e) {
    console.error('[ShellEvents] opened:', e.message);
    res.json({ ok: false });
  }
});

module.exports = router;
