# AUDITORÍA FASE IV-E — Mecanismo de ejecución de dixieScanner
Generado: Wed Jul  1 06:08:36 -03 2026

## Contexto de la línea 194 en server.js (10 líneas antes y después)

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired')
    .then(() => {
      console.log('✅ MongoDB conectado');
    assertSystemUsers().catch(e => console.error('[assertSystemUsers]', e.message));
require('./services/boostExpiry').startBoostExpiryCron();
    rtmil.init({ durabilityMode: 'SAFE' });
    console.log('[RTMIL] Pipeline activo — WAL + Backpressure + Spill');
    require('./src/core/services/financeWatchdog').iniciar();
    // Dixie Terminal — scan inicial y cron cada 30 minutos
    const { scan: dixieScan } = require('./src/sinapsis/dixieTerminal/dixieScanner');
    dixieScan().catch(e => console.error('[DixieTerminal] scan inicial:', e.message));
    cron.schedule('*/30 * * * *', () => {
      dixieScan().catch(e => console.error('[DixieTerminal] cron scan:', e.message));
    });

    require('./src/dispatch').initDispatchEngine(io).catch(e => console.error('[DispatchEngine] init error:', e.message));
    const { init: initJobReactor } = require('./nexus/reactive/jobRequestedReactor');
    initJobReactor(io);
    console.log('[jobRequestedReactor] io inicializado');

    try {
      const { router: quoteEventRouter } = require('./shared/events/router-instance');
      const auctionOutcomeProjection = require('./shared/reactors/auctionOutcomeProjection');
      auctionOutcomeProjection.init(quoteEventRouter);
    } catch (e) {
      console.error('[AuctionOutcomeProjection] init error:', e.message);

## ¿Hay setInterval / node-cron / setTimeout cerca de dixieScan en server.js?
196:    cron.schedule('*/30 * * * *', () => {
245:cron.schedule('0 8,20 * * *', () => {
249:setTimeout(() => ejecutarCicloAladin().catch(console.error), 10000);
253:cron.schedule('0 20 * * *', async () => {
294:cron.schedule('0 22 * * *', async () => {
327:cron.schedule('0 * * * *', async () => {
383:cron.schedule('30 * * * *', async () => {
429:cron.schedule('0 * * * *', async () => {
471:setInterval(() => {

## routes/dixieTerminal.js completo
// dixieTerminal.js — rutas de Dixie Gate Terminal
// GET  /api/sinapsis/dixie/findings      — lista findings con filtros
// GET  /api/sinapsis/dixie/report        — resumen ejecutivo + estado operativo
// POST /api/sinapsis/dixie/scan          — trigger manual de scan
// POST /api/sinapsis/dixie/degraded/on   — activa modo degradado (Sprint 3C-A, manual)
// POST /api/sinapsis/dixie/degraded/off  — desactiva modo degradado

const express = require('express');
const router  = express.Router();
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { scan }           = require('../../sinapsis/dixieTerminal/dixieScanner');
const { PolicyFinding }  = require('../../sinapsis/dixieTerminal/PolicyFinding');
const { SystemState, getState } = require('../../sinapsis/dixieTerminal/SystemState');

// POST /scan — trigger manual
router.post('/scan', verificarToken, soloAdmin, async (req, res) => {
  try {
    const result = await scan();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /findings — lista paginada con filtros opcionales
// Query params: status (OPEN|ACKNOWLEDGED), rule, limit (default 50)
router.get('/findings', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { status, rule, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (rule)   filter.rule   = rule;

    const findings = await PolicyFinding
      .find(filter)
      .sort({ detectedAt: -1 })
      .limit(Math.min(Number(limit), 200))
      .lean();

    res.json({ ok: true, total: findings.length, findings });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /degraded/on — activa modo degradado manualmente (observacional, Sprint 3C-A)
router.post('/degraded/on', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const updated = await SystemState.findByIdAndUpdate(
      'global',
      { mode: 'DEGRADED', reason: reason || 'Activado manualmente sin motivo especificado' },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(JSON.stringify({
      level: 'warn', source: 'SYSTEM_STATE',
      action: 'SET_DEGRADED_MODE', actor: req.user?.nombre || req.user?.userId,
      reason: updated.reason, timestamp: new Date().toISOString()
    }));
    res.json({ ok: true, mode: updated.mode, reason: updated.reason });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /degraded/off — vuelve a modo normal
router.post('/degraded/off', verificarToken, soloAdmin, async (req, res) => {
  try {
    const updated = await SystemState.findByIdAndUpdate(
      'global',
      { mode: 'NORMAL', reason: null },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(JSON.stringify({
      level: 'info', source: 'SYSTEM_STATE',
      action: 'CLEAR_DEGRADED_MODE', actor: req.user?.nombre || req.user?.userId,
      timestamp: new Date().toISOString()
    }));
    res.json({ ok: true, mode: updated.mode, reason: updated.reason });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /report — resumen ejecutivo con agregaciones + estado operativo
router.get('/report', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [open, total, bySeverity, byRule, latest, state] = await Promise.all([
      PolicyFinding.countDocuments({ status: 'OPEN' }),
      PolicyFinding.countDocuments(),
      PolicyFinding.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      PolicyFinding.aggregate([
        { $group: { _id: '$rule', open: { $sum: { $cond: [{ $eq: ['$status','OPEN'] }, 1, 0] } }, total: { $sum: 1 } } }
      ]),
      PolicyFinding.findOne({ status: 'OPEN' }).sort({ detectedAt: -1 }).lean(),
      getState()
    ]);

    res.json({
      ok:          true,
      generatedAt: new Date().toISOString(),
      health:      open === 0 ? 'CLEAN' : open < 3 ? 'DEGRADED' : 'ALERT',
      mode:        state.mode,
      modeReason:  state.reason,
      summary: {
        open,
        total,
        acknowledged: total - open
      },
      bySeverity: Object.fromEntries(bySeverity.map(x => [x._id, x.count])),
      byRule:     Object.fromEntries(byRule.map(x => [x._id, { open: x.open, total: x.total }])),
      latestOpen: latest ? {
        findingId:  latest.findingId,
        rule:       latest.rule,
        severity:   latest.severity,
        detectedAt: latest.detectedAt
      } : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;

## ¿Algún cron externo o Render cronjob referenciado en el repo?
./package-lock.json
./package.json

## Última vez que corrió: query directa no posible sin DB, pero buscamos timestamps hardcodeados o docs
194:    const { scan: dixieScan } = require('./src/sinapsis/dixieTerminal/dixieScanner');
195:    dixieScan().catch(e => console.error('[DixieTerminal] scan inicial:', e.message));
197:      dixieScan().catch(e => console.error('[DixieTerminal] cron scan:', e.message));
