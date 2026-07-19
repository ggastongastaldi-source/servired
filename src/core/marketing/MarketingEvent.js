'use strict';

const mongoose = require('mongoose');

const EVENT_TYPES = [
  // Core
  'usuario_registrado',
  'profesional_aprobado',
  'servicio_publicado',
  'resena_recibida',
  'contratacion_realizada',
  // Boost funnel
  'boost_viewed',
  'boost_started',
  'boost_paid',
  // Commerce feed
  'commerce_feed_view',
  'commerce_feed_click',
  // Asistente
  'assistant_boost_chip_click',
  'assistant_session_started',
  // Wizard comercio
  'commerce_register_started',
  'commerce_register_completed',
  // SEO / Market Intelligence
  'SEO_SERVICE_VIEWED',
  'ZONE_PAGE_VIEWED',
  'ECONOMIC_NETWORK_VIEWED',
  'LEGAL_CONSENT_RECORDED',
  'LEGAL_DOCUMENT_PUBLISHED',
];

const marketingEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
      index: true,
    },
    oficio: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    localidad: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['cliente', 'trabajador', 'admin', 'sistema', 'visitante'],
      default: 'sistema',
    },
    // ── Campos territoriales (sensor MOS) ───────────────────────────────
    economicCorridor: { type: String, trim: true, index: true },
    municipality:     { type: String, trim: true, index: true },
    neighborhood:     { type: String, trim: true },
    province:         { type: String, trim: true },
    region:           { type: String, trim: true, index: true },
    priorityTier:     { type: Number, index: true },
    economicNodeId:   { type: String, trim: true, index: true },
    // ── Campos temporales ────────────────────────────────────────────────
    sessionId:   { type: String, trim: true, index: true },
    weekOfYear:  { type: Number },
    dayOfWeek:   { type: String, trim: true },
    hourBucket:  { type: String, trim: true, index: true },
    year:        { type: Number },
    month:       { type: Number },
    intentType:  { type: String, trim: true, index: true },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'marketing_events',
  }
);

// Insert-only: nunca modificar eventos existentes
marketingEventSchema.pre('findOneAndUpdate', function () {
  throw new Error('MarketingEvent es insert-only. Usá create() en lugar de update().');
});
marketingEventSchema.pre('updateOne', function () {
  throw new Error('MarketingEvent es insert-only. Usá create() en lugar de update().');
});
marketingEventSchema.pre('updateMany', function () {
  throw new Error('MarketingEvent es insert-only. Usá create() en lugar de update().');
});

const MarketingEvent = mongoose.model('MarketingEvent', marketingEventSchema);

async function registrarEvento({
  type, oficio, localidad, slug, actorId, actorRole, meta,
  // Campos territoriales y temporales (seoEventEnricher)
  economicCorridor, municipality, neighborhood, province,
  region, priorityTier, economicNodeId,
  sessionId, weekOfYear, dayOfWeek, hourBucket, year, month, intentType,
} = {}) {
  try {
    const evento = await MarketingEvent.create({
      type,
      oficio,
      localidad,
      slug,
      actorId,
      actorRole,
      // Campos territoriales (del enriquecedor)
      economicCorridor, municipality, neighborhood, province,
      region, priorityTier, economicNodeId,
      // Campos temporales
      sessionId, weekOfYear, dayOfWeek, hourBucket, year, month, intentType,
      meta: meta || {},
    });
    return { ok: true, id: evento._id };
  } catch (err) {
    // Fire-and-forget seguro: nunca rompe el flujo principal
    console.error('[MarketingEvent] Error registrando evento:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { MarketingEvent, registrarEvento, EVENT_TYPES };
