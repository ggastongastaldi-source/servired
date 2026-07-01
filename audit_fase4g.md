# AUDITORÍA FASE IV-G — Modelo AladdinInsight + agregación plataforma
Generado: Wed Jul  1 06:55:33 -03 2026

## Modelo AladdinInsight completo
./models/AladdinInsight.js
"use strict";
const mongoose = require("mongoose");

// Read model propio de Aladdin Intelligence — NO es fuente de verdad.
// Trazabilidad completa: sourceEventIds apunta a sinapsis_bus_log.
const AladdinInsightSchema = new mongoose.Schema({
  insightId:      { type: String, required: true },
  insightType:    { type: String, required: true },
  zonaId:         { type: String, default: null },
  rubroId:        { type: String, default: null },
  requestId:      { type: String, default: null },
  confidence:     { type: Number, min: 0, max: 1, required: true },
  message:        { type: String, required: true },
  sourceEventIds: [{ type: String }],
  status:         { type: String, enum: ["active", "dismissed"], default: "active" },
  generatedAt:    { type: Date, required: true },
  version:        { type: Number, default: 1 },
}, { collection: "aladdin_insights" });

AladdinInsightSchema.index({ insightId: 1 }, { unique: true });
AladdinInsightSchema.index({ insightType: 1, generatedAt: -1 });
AladdinInsightSchema.index({ zonaId: 1 });

module.exports = mongoose.models.AladdinInsight ||
  mongoose.model("AladdinInsight", AladdinInsightSchema);

## ¿Existe ya alguna agregación cross-merchant (todos los comercios, no uno solo)?

## ¿Existe ya alguna agregación cross-insight de AladdinInsight?

## AuctionOutcome — schema (para saber qué campos agregar en Aladdín)
./models/AuctionOutcome.js
/**
 * AuctionOutcome — Read model para Aladdín
 *
 * Construido por AuctionOutcomeProjection a partir de QUOTE_SELECTED.
 * Nunca se escribe directamente. Solo el reactor escribe aquí.
 * Aladdín lee pero nunca escribe.
 *
 * Cada documento representa una subasta completa:
 * una solicitud + todas las cotizaciones que participaron + ganadora.
 */
"use strict";

const mongoose = require("mongoose");

const CotizacionSchema = new mongoose.Schema(
  {
    quoteId:     { type: String, required: true },
    prestadorId: { type: String, required: true },
    precio:      { type: Number, required: true },
    moneda:      { type: String, default: "ARS" },
    rubroId:     { type: String },
    zonaId:      { type: String },
    enviadaEn:   { type: Date },
    // Tiempo entre REQUEST_CREATED y QUOTE_SENT (ms) — señal de disponibilidad
    tiempoRespuestaMs: { type: Number },
    selected:    { type: Boolean, default: false },
    // "rejected" es estado derivado: selected === false en subasta resuelta
  },
  { _id: false }
);

const AuctionOutcomeSchema = new mongoose.Schema(
  {
    requestId:        { type: String, required: true, unique: true, index: true },
    clienteId:        { type: String, required: true },
    rubroId:          { type: String },
    zonaId:           { type: String },

    // Snapshot completo de la competencia
    cotizaciones:     { type: [CotizacionSchema], default: [] },
    totalParticipantes: { type: Number, default: 0 },

    // Ganadora
    quoteSeleccionadaId:  { type: String, required: true },
    precioGanador:        { type: Number, required: true },
    prestadorGanadorId:   { type: String, required: true },

    // Estadísticas de la subasta (para Aladdín)
    precioMinimo:     { type: Number },
    precioMaximo:     { type: Number },
    precioPromedio:   { type: Number },
    // Posición del ganador en ranking por precio (1 = más barato)
    posicionPrecioGanador: { type: Number },

    // Trazabilidad
    eventoSeleccionId:  { type: String },  // event_id de QUOTE_SELECTED
    resueltaEn:         { type: Date, required: true },

    // Control de proyección
    version: { type: Number, default: 1 },
  },
  {
    collection: "auction_outcomes",
    timestamps: { createdAt: "creadaEn", updatedAt: "actualizadaEn" },
  }
);

AuctionOutcomeSchema.index({ rubroId: 1, resueltaEn: -1 });
AuctionOutcomeSchema.index({ zonaId: 1, resueltaEn: -1 });
AuctionOutcomeSchema.index({ prestadorGanadorId: 1 });

module.exports =
  mongoose.models.AuctionOutcome ||
  mongoose.model("AuctionOutcome", AuctionOutcomeSchema);
