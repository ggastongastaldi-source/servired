'use strict';
/**
 * seoIntelligenceReactor.js — Reactor de Inteligencia Territorial del MOS
 *
 * Consume marketing_events (append-only) de forma incremental
 * y materializa proyecciones en seo_intelligence_projection.
 *
 * Patrón: igual que tensionScheduler / escrowReleaseJob.
 * Checkpoint incremental — O(eventos nuevos), no O(total).
 *
 * Proyección por (economicNodeId + oficio + day):
 *   views, uniqueSessions, byHourBucket, byDayOfWeek,
 *   topServices, lastSeen, corridor, priorityTier
 */

const mongoose = require('mongoose');

// ── Schemas ───────────────────────────────────────────────────────────────────

const reactorStateSchema = new mongoose.Schema({
  reactor:         { type: String, required: true, unique: true },
  lastProcessedAt: { type: Date,   default: () => new Date(0) },
}, { collection: 'seo_reactor_state' });

const projectionSchema = new mongoose.Schema({
  // Clave de partición
  economicNodeId: { type: String, required: true, index: true },
  oficio:         { type: String, required: true, index: true },
  day:            { type: String, required: true, index: true }, // 'YYYY-MM-DD'

  // Contexto territorial (desnormalizado para queries rápidas)
  corridor:       { type: String, index: true },
  municipality:   { type: String },
  priorityTier:   { type: Number, index: true },
  region:         { type: String },

  // Métricas
  views:          { type: Number, default: 0 },
  uniqueSessions: { type: [String], default: [] }, // set de sessionIds

  // Distribuciones
  byHourBucket: {
    dawn:      { type: Number, default: 0 },
    morning:   { type: Number, default: 0 },
    afternoon: { type: Number, default: 0 },
    evening:   { type: Number, default: 0 },
    night:     { type: Number, default: 0 },
  },
  byDayOfWeek: {
    monday:    { type: Number, default: 0 },
    tuesday:   { type: Number, default: 0 },
    wednesday: { type: Number, default: 0 },
    thursday:  { type: Number, default: 0 },
    friday:    { type: Number, default: 0 },
    saturday:  { type: Number, default: 0 },
    sunday:    { type: Number, default: 0 },
  },

  lastSeen:  { type: Date },
  updatedAt: { type: Date },
}, {
  collection: 'seo_intelligence_projection',
  timestamps: false,
});

// Índice compuesto — clave natural de la proyección
projectionSchema.index({ economicNodeId: 1, oficio: 1, day: 1 }, { unique: true });
// Índices de consulta frecuente
projectionSchema.index({ corridor: 1, day: 1 });
projectionSchema.index({ priorityTier: 1, day: 1 });
projectionSchema.index({ oficio: 1, day: 1 });

const ReactorState  = mongoose.model('SeoReactorState',      reactorStateSchema);
const SEOProjection = mongoose.model('SEOIntelligenceProjection', projectionSchema);

// ── Lógica del reactor ────────────────────────────────────────────────────────

const REACTOR_ID   = 'seo-intelligence';
const SEO_TYPES    = ['SEO_SERVICE_VIEWED', 'ZONE_PAGE_VIEWED'];
const BATCH_SIZE   = 500;
const UNKNOWN_NODE = 'UNKNOWN:UNKNOWN:UNKNOWN';

function toDay(date) {
  return date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

async function runSEOIntelligenceReactor() {
  const label = '[seoIntelligenceReactor]';
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn(`${label} Mongo no conectado — saltando ciclo`);
      return;
    }

    // 1. Leer checkpoint
    let state = await ReactorState.findOne({ reactor: REACTOR_ID });
    if (!state) {
      state = await ReactorState.create({ reactor: REACTOR_ID });
      console.log(`${label} Checkpoint inicializado`);
    }
    const since = state.lastProcessedAt;

    // 2. Leer eventos nuevos en batches
    const col    = mongoose.connection.collection('marketing_events');
    const cursor = col.find({
      type:      { $in: SEO_TYPES },
      createdAt: { $gt: since },
    }).sort({ createdAt: 1 }).batchSize(BATCH_SIZE);

    let processed = 0;
    let lastSeen  = since;
    const updates = new Map(); // key → delta acumulado

    for await (const ev of cursor) {
      const nodeId  = ev.economicNodeId || UNKNOWN_NODE;
      const oficio  = (ev.oficio  || '_zona').toLowerCase().trim();
      const day     = toDay(ev.createdAt);
      const key     = `${nodeId}|${oficio}|${day}`;

      if (!updates.has(key)) {
        updates.set(key, {
          economicNodeId: nodeId,
          oficio,
          day,
          corridor:     ev.economicCorridor || null,
          municipality: ev.municipality     || null,
          priorityTier: ev.priorityTier     ?? null,
          region:       ev.region           || null,
          views:        0,
          sessions:     new Set(),
          byHourBucket: { dawn:0, morning:0, afternoon:0, evening:0, night:0 },
          byDayOfWeek:  { monday:0, tuesday:0, wednesday:0, thursday:0, friday:0, saturday:0, sunday:0 },
          lastSeen:     ev.createdAt,
        });
      }

      const d = updates.get(key);
      d.views++;
      if (ev.sessionId) d.sessions.add(ev.sessionId);
      if (ev.hourBucket && d.byHourBucket[ev.hourBucket] !== undefined)
        d.byHourBucket[ev.hourBucket]++;
      if (ev.dayOfWeek  && d.byDayOfWeek[ev.dayOfWeek]   !== undefined)
        d.byDayOfWeek[ev.dayOfWeek]++;
      if (ev.createdAt > d.lastSeen) d.lastSeen = ev.createdAt;
      if (ev.createdAt > lastSeen)   lastSeen   = ev.createdAt;
      processed++;
    }

    if (processed === 0) {
      console.log(`${label} Sin eventos nuevos desde ${since.toISOString()}`);
      return;
    }

    // 3. Upsert de proyecciones (bulk)
    const ops = [];
    for (const [, d] of updates) {
      const hourInc = {};
      for (const [k, v] of Object.entries(d.byHourBucket))
        if (v) hourInc[`byHourBucket.${k}`] = v;
      const dayInc = {};
      for (const [k, v] of Object.entries(d.byDayOfWeek))
        if (v) dayInc[`byDayOfWeek.${k}`] = v;

      ops.push({
        updateOne: {
          filter: { economicNodeId: d.economicNodeId, oficio: d.oficio, day: d.day },
          update: {
            $inc: { views: d.views, ...hourInc, ...dayInc },
            $addToSet: { uniqueSessions: { $each: [...d.sessions] } },
            $set: {
              corridor:     d.corridor,
              municipality: d.municipality,
              priorityTier: d.priorityTier,
              region:       d.region,
              lastSeen:     d.lastSeen,
              updatedAt:    new Date(),
            },
            $setOnInsert: { oficio: d.oficio, day: d.day, economicNodeId: d.economicNodeId },
          },
          upsert: true,
        },
      });
    }

    await SEOProjection.bulkWrite(ops, { ordered: false });

    // 4. Actualizar checkpoint
    await ReactorState.updateOne(
      { reactor: REACTOR_ID },
      { $set: { lastProcessedAt: lastSeen } }
    );

    console.log(`${label} ✅ ${processed} eventos → ${ops.length} proyecciones actualizadas`);

  } catch (err) {
    console.error(`${label} Error en ciclo:`, err.message);
  }
}

// ── Scheduling — igual que tensionScheduler ───────────────────────────────────
const INITIAL_DELAY =  60 * 1000; //  1 min — dar tiempo a Mongo de conectar
const INTERVAL      =  15 * 60 * 1000; // 15 min

setTimeout(async () => {
  console.log('[seoIntelligenceReactor] 🕐 Primera ejecución...');
  await runSEOIntelligenceReactor();
}, INITIAL_DELAY);

setInterval(async () => {
  console.log('[seoIntelligenceReactor] 🔄 Ciclo periódico...');
  await runSEOIntelligenceReactor();
}, INTERVAL);

console.log('[seoIntelligenceReactor] ✅ Reactor activo (ciclo cada 15 min)');

module.exports = { runSEOIntelligenceReactor, SEOProjection, ReactorState };
