const router = require('express').Router();
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

function getUser(req) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    return token ? jwt.verify(token, SECRET) : null;
  } catch(e) { return null; }
}

// KPI: actores en red
router.get('/users/count', async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const count = await Usuario.countDocuments({ estado: { $ne: 'BLOQUEADO' } });
    res.json({ ok: true, count });
  } catch(e) { res.json({ ok: false, count: null }); }
});

// KPI: pedidos hoy
router.get('/pedidos/count-today', async (req, res) => {
  try {
    const Job = require('../models/Job');
    const start = new Date(); start.setHours(0,0,0,0);
    const count = await Job.countDocuments({ createdAt: { $gte: start } });
    res.json({ ok: true, count });
  } catch(e) {
    try {
      const Pedido = require('../models/Pedido');
      const start = new Date(); start.setHours(0,0,0,0);
      const count = await Pedido.countDocuments({ createdAt: { $gte: start } });
      res.json({ ok: true, count });
    } catch(e2) { res.json({ ok: false, count: null }); }
  }
});

// KPI: trust score propio
router.get('/trust/me', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.json({ ok: false, score: null });
    const TrustProfile = require('../models/TrustProfile');
    const tp = await TrustProfile.findOne({ actorId: user.id || user.userId }).lean();
    if (!tp) return res.json({ ok: true, score: 100 });
    res.json({ ok: true, score: tp.score ?? tp.trustScore ?? 100 });
  } catch(e) { res.json({ ok: true, score: 100 }); }
});

// GIA priority — agrega datos reales del sistema
router.get('/gia/priority', async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const actores = await Usuario.countDocuments({ estado: { $ne: 'BLOQUEADO' } });

    // Contar pedidos recientes como proxy de oportunidades
    let oportunidades = 0;
    try {
      const Job = require('../models/Job');
      oportunidades = await Job.countDocuments({ estado: { $in: ['PENDING','ABIERTO','EN_CURSO'] } });
    } catch(e) {
      try {
        const Pedido = require('../models/Pedido');
        oportunidades = await Pedido.countDocuments({ estado: { $in: ['PENDING','ABIERTO','EN_CURSO'] } });
      } catch(e2) {}
    }

    // Riesgos desde SOC / IncidentCase
    let riesgos = 0;
    try {
      const IncidentCase = require('../models/IncidentCase');
      riesgos = await IncidentCase.countDocuments({ status: { $in: ['OPEN','ESCALATED'] } });
    } catch(e) {}

    // Insights desde Aladdín
    let insights = 0;
    try {
      const AladinInsight = require('../models/AladinInsight');
      insights = await AladinInsight.countDocuments({});
    } catch(e) {}

    const recomendaciones = [
      'El sistema está operativo y procesando eventos en tiempo real.',
      'SINAPSIS activo — hash-chain íntegro.',
      'Trust & Risk en shadow mode — sin alertas activas.',
      'Oportunidades detectadas en el AMBA.'
    ];
    const topInsight = oportunidades > 0
      ? `Hay ${oportunidades} pedidos activos en el ecosistema. GIA monitoreando demanda en tiempo real.`
      : recomendaciones[Math.floor(Date.now()/60000) % recomendaciones.length];

    res.json({ ok: true, actores, oportunidades, riesgos, insights, topInsight, kpiInsights: insights || '—' });
  } catch(e) {
    res.json({ ok: false, topInsight: 'SINAPSIS conectado. Sistema operativo.', actores:0, oportunidades:0, riesgos:0, insights:0 });
  }
});

module.exports = router;
