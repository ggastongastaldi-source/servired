// ServiRed Command Center (SOC) — Fase IV, Bloque 1
// Read-only. Nunca escribe sobre el dominio. Solo agrega Read Models existentes.
const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../src/core/middleware/auth');
const { getAll: getNexusCircuits } = require('../nexus/infrastructure/circuitBreaker');

// GET /api/soc/bus-status
// Agrega: estado de circuitos Nexus + snapshot del ObserverService (runtime)
router.get('/bus-status', verificarToken, soloAdmin, (req, res) => {
  try {
    const nexusCircuits = getNexusCircuits();
    const observerSnapshot = global.observerSnapshot || null;

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      nexus: {
        circuits: nexusCircuits,
        totalCircuits: nexusCircuits.length,
      },
      observer: observerSnapshot,
      note: 'Sinapsis/DixieTerminal circuit breaker (modo DEGRADED global) se agrega en un bloque posterior — es un mecanismo separado del de Nexus.',
    });
  } catch (e) {
    console.error('[SOC/bus-status]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
