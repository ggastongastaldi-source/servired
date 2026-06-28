/**
 * Quote — Agregado de cotización
 *
 * Fuente de verdad: SINAPSIS (sinapsis_bus_log).
 * Este modelo es el estado proyectado del agregado.
 * Solo QuoteService escribe aquí vía aplicación de eventos.
 *
 * Ciclo de vida:
 *   QUOTE_CREATED → QUOTE_SENT → QUOTE_SELECTED
 *                             ↘ QUOTE_UPDATED → QUOTE_SENT
 *                             ↘ QUOTE_EXPIRED
 *                             ↘ QUOTE_WITHDRAWN
 *
 * Estado derivado (nunca evento de dominio):
 *   "rejected" → calculado por AuctionOutcomeProjection
 *                cuando QUOTE_SELECTED elige otra quoteId del mismo requestId
 */
"use strict";

const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema(
  {
    quoteId:      { type: String, required: true, unique: true, index: true },
    requestId:    { type: String, required: true, index: true },
    prestadorId:  { type: String, required: true, index: true },
    clienteId:    { type: String, required: true },

    // Datos económicos
    precio:       { type: Number, required: true },
    moneda:       { type: String, default: "ARS" },
    descripcion:  { type: String },
    validezHasta: { type: Date },

    // Contexto para Aladdín
    rubroId:      { type: String },
    zonaId:       { type: String },

    // Estado del ciclo de vida
    status: {
      type: String,
      enum: ["created", "sent", "selected", "expired", "withdrawn", "rejected"],
      default: "created",
      index: true,
    },

    // Trazabilidad de eventos
    creadaEn:     { type: Date },
    enviadaEn:    { type: Date },
    actualizadaEn:{ type: Date },
    seleccionadaEn:{ type: Date },
    expiradaEn:   { type: Date },
    retiradaEn:   { type: Date },
    rechazadaEn:  { type: Date },  // calculado por reactor, no por evento

    // Control de proyección
    ultimoEventoId:      { type: String },
    ultimoEventoTipo:    { type: String },
    version:             { type: Number, default: 0 },
  },
  {
    collection: "quotes",
    timestamps: { createdAt: "registradaEn", updatedAt: "modificadaEn" },
  }
);

QuoteSchema.index({ requestId: 1, status: 1 });
QuoteSchema.index({ prestadorId: 1, status: 1 });

module.exports =
  mongoose.models.Quote || mongoose.model("Quote", QuoteSchema);
