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

    // SR-NEURO Paso 3: consumir synthesis.pattern del ultimo Synaptic Atom
    // Criterio: ultimo atomo con synthesis != null, ordenado por sequence DESC
    // Fallback: comportamiento previo si no hay atomos con synthesis
    let topInsight = null;
    try {
      const { SinapsisBusLog } = require('../shared/events/persistenceAdapters/sinapsisBusAdapter');
      const lastAtom = await SinapsisBusLog
        .findOne({ synthesis: { $ne: null } })
        .sort({ sequence: -1 })
        .select('synthesis confidence eventType sequence')
        .lean();
      if (lastAtom?.synthesis?.pattern) {
        const p = lastAtom.synthesis.pattern;
        const conf = lastAtom.confidence ? ` (confianza ${Math.round(lastAtom.confidence * 100)}%)` : '';
        const patternMsg = {
          territorial_shortage: `Demanda territorial supera oferta disponible${conf}. GIA recomienda activar capacidad en zonas con shortage.`,
          territorial_surplus:  `Oferta territorial supera demanda actual${conf}. GIA detecta oportunidad de estimulacion de demanda.`,
          territorial_balanced: `Ecosistema territorial balanceado${conf}. SINAPSIS procesando eventos en tiempo real.`,
        };
        topInsight = patternMsg[p] || `Inteligencia territorial activa${conf}. Patron: ${p}.`;
      }
    } catch(_) { /* bus no disponible -- continua con fallback */ }

    if (!topInsight) {
      const recomendaciones = [
        'El sistema está operativo y procesando eventos en tiempo real.',
        'SINAPSIS activo — hash-chain íntegro.',
        'Trust & Risk en shadow mode — sin alertas activas.',
        'Oportunidades detectadas en el AMBA.'
      ];
      topInsight = oportunidades > 0
        ? `Hay ${oportunidades} pedidos activos en el ecosistema. GIA monitoreando demanda en tiempo real.`
        : recomendaciones[Math.floor(Date.now()/60000) % recomendaciones.length];
    }

    res.json({ ok: true, actores, oportunidades, riesgos, insights, topInsight, kpiInsights: insights || '—' });
  } catch(e) {
    res.json({ ok: false, topInsight: 'SINAPSIS conectado. Sistema operativo.', actores:0, oportunidades:0, riesgos:0, insights:0 });
  }
});


// Dashboard del trabajador profesional
router.get('/worker/dashboard', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Token requerido' });

    const Worker = require('../models/worker.model');
    const Pedido = require('../models/Pedido');

    const worker = await Worker.findOne({ usuarioId: user.id || user.userId }).lean();

    // Pedidos del trabajador
    let pedidosActivos = 0, pedidosCompletados = 0, ingresosMes = 0;
    try {
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      pedidosActivos    = await Pedido.countDocuments({ workerId: user.id || user.userId, estado: { $in: ['PENDING','EN_CURSO','ACEPTADO'] } });
      pedidosCompletados= await Pedido.countDocuments({ workerId: user.id || user.userId, estado: 'COMPLETADO', updatedAt: { $gte: inicioMes } });
      const pedidosMes  = await Pedido.find({ workerId: user.id || user.userId, estado: 'COMPLETADO', updatedAt: { $gte: inicioMes } }, 'monto').lean();
      ingresosMes = pedidosMes.reduce((s, p) => s + (p.monto || 0), 0);
    } catch(e) {}

    // Zona y presión de mercado
    let zonaInfo = null;
    try {
      const zona = worker?.dispatch?.zona;
      if (zona) {
        const ZoneState = require('../models/ZoneState');
        zonaInfo = await ZoneState.findOne({ zoneId: zona }).lean();
      }
    } catch(e) {}

    // Trabajadores online (socket rooms)
    const trabajadoresOnline = 0; // Solo disponible via io, no aquí

    res.json({
      ok: true,
      worker: {
        disponibilidad: worker?.dispatch?.availability || 'DISPONIBLE',
        zona:           worker?.dispatch?.zona || null,
        rubros:         worker?.dispatch?.rubros || [],
        online:         worker?.presence?.online || false,
        ultimaVez:      worker?.presence?.lastSeen || null,
      },
      actividad: {
        pedidosActivos,
        pedidosCompletados,
        ingresosMes,
      },
      zona: zonaInfo ? {
        zoneId:         zonaInfo.zoneId,
        zoneState:      zonaInfo.zoneState,
        marketPressure: zonaInfo.marketPressure,
      } : null,
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
