// ServiRed — NarrativeObserver v1.0
// EventStore como Fuente Creativa — eventos son historias, no logs
// TRS: Trust Reinforcement Score

const { emitEvent } = require('../events/emitEvent');
const { enqueue } = require('../infrastructure/outbox');

// ── TRS WEIGHTS ──────────────────────────────────────────────
const W = {
  autoRecovery:      0.25,
  resilience:        0.20,
  lowUserImpact:     0.20,
  fallback:          0.15,
  anomalyDetection:  0.10,
  trustDamage:      -0.30,
  chaos:            -0.20,
  manualIntervention:-0.15,
};

// ── EVENT → NARRATIVE MAP ────────────────────────────────────
const NARRATIVES = {
  CIRCUIT_STATE_CHANGED: (e) => {
    const { from, to } = e.payload;
    if (to === 'CLOSED' && from === 'HALF_OPEN') return {
      trs: calcTRS({ autoRecovery:1, resilience:1, lowUserImpact:1 }),
      titulo: 'El sistema se recuperó solo 💪',
      mensaje: 'Un servicio que estaba bajo presión volvió a operar normalmente de forma automática. Sin intervención humana.',
      categoria: 'resiliencia',
      icono: '🔄',
    };
    if (to === 'OPEN') return {
      trs: calcTRS({ anomalyDetection:1, lowUserImpact:1, fallback:1 }),
      titulo: 'Anomalía detectada y contenida 🛡️',
      mensaje: 'El sistema detectó un servicio degradado y lo aisló automáticamente para proteger a los usuarios.',
      categoria: 'proteccion',
      icono: '🛡️',
    };
    return null;
  },

  POLICY_SHIFT: (e) => {
    const { reason, severity } = e.payload;
    if (severity === 'CRITICAL') return null; // Dixie Gate: no publicar emergencias
    if (reason === 'MODO_EMERGENCIA_DESACTIVADO') return {
      trs: calcTRS({ autoRecovery:1, resilience:1, lowUserImpact:1, fallback:1 }),
      titulo: 'Modo de protección completado ✅',
      mensaje: 'El sistema activó y desactivó automáticamente su modo de protección. Todo volvió a la normalidad.',
      categoria: 'resiliencia',
      icono: '✅',
    };
    return null;
  },

  PEDIDO_PAGADO: (e) => ({
    trs: calcTRS({ lowUserImpact:1, resilience:1 }),
    titulo: 'Servicio completado y cobrado 💰',
    mensaje: `Un profesional verificado completó un trabajo en ${e.payload.zona||'AMBA'} y el pago fue procesado de forma segura por Mercado Pago.`,
    categoria: 'operacion',
    icono: '💳',
  }),

  WORKER_VERIFICADO: (e) => ({
    trs: calcTRS({ lowUserImpact:1, anomalyDetection:1 }),
    titulo: 'Nuevo profesional verificado 👷',
    mensaje: `Un nuevo profesional de ${e.payload.rubro||'servicios'} fue verificado y está disponible en la red ServiRed.`,
    categoria: 'red',
    icono: '👷',
  }),

  VALIDATION_RUN: (e) => {
    if (!e.payload.allOk) return null; // Dixie Gate: no publicar fallos
    return {
      trs: calcTRS({ autoRecovery:1, resilience:1, lowUserImpact:1, anomalyDetection:1, fallback:1 }),
      titulo: 'Infraestructura validada bajo estrés ✅',
      mensaje: 'ServiRed pasó todos los tests de resiliencia automáticos. El sistema está operando con máxima confiabilidad.',
      categoria: 'infraestructura',
      icono: '🧪',
    };
  },

  SNAPSHOT_DIVERGENCE_DETECTED: () => null, // Dixie Gate: bloquear
};

// ── TRS CALCULATOR ───────────────────────────────────────────
function calcTRS(factors = {}) {
  let score = 0;
  for (const [key, active] of Object.entries(factors)) {
    if (active && W[key]) score += W[key];
  }
  return Math.min(1, Math.max(0, score));
}

// ── NARRATIVE OBSERVER ───────────────────────────────────────
async function observe(event) {
  try {
    const mapper = NARRATIVES[event.type];
    if (!mapper) return; // Sin narrativa para este evento

    const narrative = mapper(event);
    if (!narrative) return; // Dixie Gate bloqueó

    // TRS mínimo para publicar
    if (narrative.trs < 0.3) return;

    const marketingEntry = {
      eventId:       event.eventId,
      correlationId: event.correlationId,
      tipo:          event.type,
      entityType:    event.entityType,
      aggregateId:   event.aggregateId,
      trs:           narrative.trs,
      titulo:        narrative.titulo,
      mensaje:       narrative.mensaje,
      categoria:     narrative.categoria,
      icono:         narrative.icono,
      timestamp:     event.timestamp || new Date(),
      publicado:     false,
    };

    // Persistir en marketing_outbox
    const mongoose = require('mongoose');
    await mongoose.connection.collection('marketing_outbox')
      .insertOne(marketingEntry);

    // Encolar para distribución futura (email, RRSS, etc.)
    await enqueue({
      workflowId:   `narrative_${event.eventId}`,
      logicalStep:  'publish',
      channel:      'narrative',
      template:     narrative.categoria,
      payload:      marketingEntry,
      correlationId: event.correlationId,
    });

    console.log(`[NarrativeObserver] 📖 TRS:${narrative.trs.toFixed(2)} → "${narrative.titulo}"`);

    // Emitir al admin en tiempo real
    const io = global._io;
    if (io) {
      io.to('admins').emit('narrative_event', marketingEntry);
    }

  } catch(e) {
    console.error('[NarrativeObserver] Error:', e.message);
  }
}

// Feed de narrativas recientes
async function getFeed(limit = 20) {
  const mongoose = require('mongoose');
  return mongoose.connection.collection('marketing_outbox')
    .find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

// Stats TRS
async function getTRSStats() {
  const mongoose = require('mongoose');
  const entries = await mongoose.connection.collection('marketing_outbox')
    .find({}).toArray();
  if (!entries.length) return { avg: 0, max: 0, count: 0 };
  const scores = entries.map(e => e.trs || 0);
  return {
    avg: (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(3),
    max: Math.max(...scores).toFixed(3),
    count: entries.length,
    porCategoria: entries.reduce((acc, e) => {
      acc[e.categoria] = (acc[e.categoria]||0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = { observe, getFeed, getTRSStats, calcTRS };
