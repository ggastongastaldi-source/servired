
const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth');
const { getRentabilidadPorZona, getMetricasLive } = require('../controllers/finanzasController');

// Dashboard financiero - Admin solo
router.get('/dashboard', verificarToken, verificarRol('ADMIN'), async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const [rentabilidad, live] = await Promise.all([
      getRentabilidadPorZona(dias),
      getMetricasLive()
    ]);
    
    res.json({
      ok: true,
      periodoDias: dias,
      rentabilidadPorZona: rentabilidad,
      metricasLive: live,
      moneda: 'ARS',
      comisionPct: 20
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Métricas en tiempo real (polling cada 30s)
router.get('/live', verificarToken, verificarRol('ADMIN'), async (req, res) => {
  try {
    const live = await getMetricasLive();
    res.json({ ok: true, ...live });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
