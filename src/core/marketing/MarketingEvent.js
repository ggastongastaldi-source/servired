'use strict';

const mongoose = require('mongoose');

const EVENT_TYPES = [
  'usuario_registrado',
  'profesional_aprobado',
  'servicio_publicado',
  'resena_recibida',
  'contratacion_realizada',
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
      enum: ['cliente', 'trabajador', 'admin', 'sistema'],
      default: 'sistema',
    },
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

async function registrarEvento({ type, oficio, localidad, slug, actorId, actorRole, meta } = {}) {
  try {
    const evento = await MarketingEvent.create({
      type,
      oficio,
      localidad,
      slug,
      actorId,
      actorRole,
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
