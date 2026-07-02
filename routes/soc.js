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


// GET /api/soc/dixie-status
// Reutiliza services/dixieReportService.js (misma fuente que /api/sinapsis/dixie/report).
// Scanner corre en boot + cron cada 30 min (server.js) — este endpoint SOLO lee lo ya persistido,
// nunca dispara un scan on-demand.
router.get('/dixie-status', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { buildDixieReport } = require('../services/dixieReportService');
    const report = await buildDixieReport();
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('[SOC/dixie-status]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});


// GET /api/soc/commercial-status
// Agrega MerchantProjection (read model existente) — cero recálculo desde eventos.
router.get('/commercial-status', verificarToken, soloAdmin, async (req, res) => {
  try {
    const MerchantProjection = require('../models/MerchantProjection');

    const [totales, porZona, topActividad] = await Promise.all([
      MerchantProjection.aggregate([
        { $group: {
            _id: null,
            totalComercios: { $sum: 1 },
            verificados: { $sum: { $cond: ['$verificado', 1, 0] } },
            vistasHoyTotal: { $sum: '$dashboard.vistasHoy' },
            solicitudesHoyTotal: { $sum: '$dashboard.solicitudesHoy' },
            ingresosEstimadoMesTotal: { $sum: '$dashboard.ingresosEstimadoMes' },
            boostActivosTotal: { $sum: '$dashboard.boostActivos' },
        }}
      ]),
      MerchantProjection.aggregate([
        { $group: { _id: '$zonaId', comercios: { $sum: 1 } } },
        { $sort: { comercios: -1 } },
        { $limit: 10 }
      ]),
      MerchantProjection.find({})
        .sort({ 'dashboard.vistasHoy': -1 })
        .limit(5)
        .select('nombreComercial zonaId dashboard.vistasHoy dashboard.solicitudesHoy')
        .lean()
    ]);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totales: totales[0] || {
        totalComercios: 0, verificados: 0, vistasHoyTotal: 0,
        solicitudesHoyTotal: 0, ingresosEstimadoMesTotal: 0, boostActivosTotal: 0
      },
      porZona,
      topActividad,
    });
  } catch (e) {
    console.error('[SOC/commercial-status]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/soc/aladdin-status
// Agrega AladdinInsight (read model existente, escrito solo por aladdinIntelligenceReactor).
router.get('/aladdin-status', verificarToken, soloAdmin, async (req, res) => {
  try {
    const AladdinInsight = require('../models/AladdinInsight');

    const [porTipo, activos, recientes] = await Promise.all([
      AladdinInsight.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$insightType', total: { $sum: 1 }, confidenceProm: { $avg: '$confidence' } } }
      ]),
      AladdinInsight.countDocuments({ status: 'active' }),
      AladdinInsight.find({ status: 'active' })
        .sort({ generatedAt: -1 })
        .limit(10)
        .select('insightType zonaId rubroId confidence message generatedAt')
        .lean()
    ]);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      totalActivos: activos,
      porTipo: porTipo.map(t => ({
        insightType: t._id,
        total: t.total,
        confidencePromedio: Math.round(t.confidenceProm * 100) / 100
      })),
      recientes,
    });
  } catch (e) {
    console.error('[SOC/aladdin-status]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});


// GET /api/soc/defensor-status
// Agrega IncidentCase (Capa 3/4) — casos abiertos, runbooks intentados, resueltos recientes.
// Solo lectura. runDefensor() se dispara por cron en server.js, NUNCA on-demand desde este endpoint.
router.get('/defensor-status', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { IncidentCase } = require('../src/sinapsis/dixieTerminal/IncidentCase');

    const [abiertos, resueltosRecientes, porPrioridad] = await Promise.all([
      IncidentCase.find({ status: { $in: ['OPEN', 'INVESTIGATING'] } })
        .sort({ priority: 1, detectedAt: 1 })
        .select('caseId severity priority status affectedService probableCause runbooksAttempted detectedAt')
        .lean(),
      IncidentCase.find({ status: 'RESOLVED' })
        .sort({ 'resolution.resolvedAt': -1 })
        .limit(10)
        .select('caseId affectedService resolution')
        .lean(),
      IncidentCase.aggregate([
        { $match: { status: { $in: ['OPEN', 'INVESTIGATING'] } } },
        { $group: { _id: '$priority', total: { $sum: 1 } } }
      ])
    ]);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      casosAbiertos: abiertos.length,
      abiertos,
      resueltosRecientes,
      porPrioridad,
    });
  } catch (e) {
    console.error('[SOC/defensor-status]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});


// POST /api/soc/trigger-pipeline
// TEMPORAL — dispara runSocPipeline() on-demand para validacion de integracion.
// No reemplaza el cron de 30min. Retirar o proteger mejor una vez validado el flujo completo.
router.post('/trigger-pipeline', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { runSocPipeline } = require('../src/sinapsis/dixieTerminal/socPipeline');
    const result = await runSocPipeline();
    res.json({ ok: true, result });
  } catch (e) {
    console.error('[SOC/trigger-pipeline]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
