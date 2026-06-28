/**
 * QuoteService — Comandos del agregado Quote
 *
 * Patrón: emit event → persist state.
 * El evento es la fuente de verdad (SINAPSIS).
 * El modelo Quote es la proyección del estado actual.
 *
 * Reglas:
 * - Solo se puede seleccionar una quote con status "sent"
 * - Solo el cliente del request puede seleccionar
 * - QUOTE_SELECTED dispara la lógica de rechazo en el reactor (no aquí)
 */
"use strict";

const { v4: uuidv4 } = require("uuid");
const { createEvent } = require("../../shared/events/createEvent");
const Quote = require("../../models/Quote");

// El router se inyecta en init() — mismo patrón que trustDecayReactor
let _router = null;

function init(router) {
  _router = router;
}

// ── Helpers ──────────────────────────────────────────────────────

function _emit(type, payload, { actor, context, causation } = {}) {
  const ev = createEvent({ type, actor, context, payload, causation });
  // fire-and-forget — nunca await en dominio
  _router.publish(ev).catch((err) =>
    console.error(`[QuoteService] Error publicando ${type}:`, err.message)
  );
  return ev;
}

async function _applyToProjection(quoteId, update, eventoId, eventoTipo) {
  await Quote.findOneAndUpdate(
    { quoteId },
    {
      $set: { ...update, ultimoEventoId: eventoId, ultimoEventoTipo: eventoTipo },
      $inc: { version: 1 },
    },
    { upsert: true }
  );
}

// ── Comandos ─────────────────────────────────────────────────────

/**
 * createQuote — el prestador inicia una cotización
 */
async function createQuote({ requestId, prestadorId, clienteId, precio, descripcion, validezHasta, rubroId, zonaId, actor, context }) {
  const quoteId = uuidv4();
  const ahora = new Date();

  const ev = _emit("QUOTE_CREATED", {
    quoteId, requestId, prestadorId, clienteId,
    precio, moneda: "ARS", descripcion, validezHasta, rubroId, zonaId,
  }, { actor, context });

  await _applyToProjection(quoteId, {
    quoteId, requestId, prestadorId, clienteId,
    precio, moneda: "ARS", descripcion,
    validezHasta: validezHasta ? new Date(validezHasta) : null,
    rubroId, zonaId,
    status: "created",
    creadaEn: ahora,
  }, ev.event_id, "QUOTE_CREATED");

  return { quoteId, eventId: ev.event_id };
}

/**
 * sendQuote — el prestador envía la cotización al cliente
 */
async function sendQuote({ quoteId, actor, context }) {
  const quote = await Quote.findOne({ quoteId });
  if (!quote) throw new Error(`Quote no encontrada: ${quoteId}`);
  if (!["created", "updated"].includes(quote.status)) {
    throw new Error(`Quote ${quoteId} no puede enviarse en estado "${quote.status}"`);
  }

  const ahora = new Date();
  const ev = _emit("QUOTE_SENT", { quoteId, requestId: quote.requestId, prestadorId: quote.prestadorId }, { actor, context });

  await _applyToProjection(quoteId, { status: "sent", enviadaEn: ahora }, ev.event_id, "QUOTE_SENT");

  return { quoteId, eventId: ev.event_id };
}

/**
 * updateQuote — el prestador modifica precio/descripción antes de la selección
 */
async function updateQuote({ quoteId, precio, descripcion, validezHasta, actor, context }) {
  const quote = await Quote.findOne({ quoteId });
  if (!quote) throw new Error(`Quote no encontrada: ${quoteId}`);
  if (!["created", "sent"].includes(quote.status)) {
    throw new Error(`Quote ${quoteId} no puede modificarse en estado "${quote.status}"`);
  }

  const cambios = {};
  if (precio !== undefined) cambios.precio = precio;
  if (descripcion !== undefined) cambios.descripcion = descripcion;
  if (validezHasta !== undefined) cambios.validezHasta = new Date(validezHasta);

  const ev = _emit("QUOTE_UPDATED", { quoteId, requestId: quote.requestId, ...cambios }, { actor, context });

  await _applyToProjection(quoteId, { ...cambios, status: "created", actualizadaEn: new Date() }, ev.event_id, "QUOTE_UPDATED");

  return { quoteId, eventId: ev.event_id };
}

/**
 * expireQuote — sistema expira cotización por TTL
 */
async function expireQuote({ quoteId, context }) {
  const quote = await Quote.findOne({ quoteId });
  if (!quote) throw new Error(`Quote no encontrada: ${quoteId}`);
  if (!["created", "sent"].includes(quote.status)) return null; // ya resuelta

  const ev = _emit("QUOTE_EXPIRED", { quoteId, requestId: quote.requestId }, {
    actor: { user_id: "system", role: "system" },
    context,
  });

  await _applyToProjection(quoteId, { status: "expired", expiradaEn: new Date() }, ev.event_id, "QUOTE_EXPIRED");

  return { quoteId, eventId: ev.event_id };
}

/**
 * withdrawQuote — el prestador retira su cotización
 */
async function withdrawQuote({ quoteId, actor, context }) {
  const quote = await Quote.findOne({ quoteId });
  if (!quote) throw new Error(`Quote no encontrada: ${quoteId}`);
  if (!["created", "sent"].includes(quote.status)) {
    throw new Error(`Quote ${quoteId} no puede retirarse en estado "${quote.status}"`);
  }

  const ev = _emit("QUOTE_WITHDRAWN", { quoteId, requestId: quote.requestId, prestadorId: quote.prestadorId }, { actor, context });

  await _applyToProjection(quoteId, { status: "withdrawn", retiradaEn: new Date() }, ev.event_id, "QUOTE_WITHDRAWN");

  return { quoteId, eventId: ev.event_id };
}

/**
 * selectQuote — el cliente selecciona una cotización
 * Este es el único evento de decisión. El rechazo de las demás
 * es responsabilidad de AuctionOutcomeProjection (reactor).
 */
async function selectQuote({ quoteId, clienteId, actor, context }) {
  // Transición atómica sent → selected.
  // findOneAndUpdate con filtro { quoteId, status:"sent" } garantiza
  // que solo un proceso puede ganar la carrera.
  const ahora = new Date();

  // ── Paso 1: transición atómica sent → selected ───────────────
  const updated = await Quote.findOneAndUpdate(
    { quoteId, status: "sent" },
    { $set: { status: "selected", seleccionadaEn: ahora } },
    { new: true }
  );

  // ── Paso 2: si la transición no ocurrió ──────────────────────
  if (!updated) {
    const current = await Quote.findOne({ quoteId });
    if (!current) throw new Error(`Quote no encontrada: ${quoteId}`);
    if (current.status === "selected") {
      console.warn(`[QuoteService] selectQuote idempotente: ${quoteId} ya seleccionada`);
      return { quoteId, eventId: current.ultimoEventoId, idempotent: true };
    }
    throw new Error(`Quote ${quoteId} no puede seleccionarse en estado "${current.status}"`);
  }

  // ── Paso 3: guard de invarianza a nivel requestId ────────────
  // Una sola ganadora por solicitud.
  const otraSeleccionada = await Quote.exists({
    requestId: updated.requestId,
    status: "selected",
    quoteId: { $ne: quoteId },
  });

  if (otraSeleccionada) {
    await Quote.findOneAndUpdate(
      { quoteId },
      { $set: { status: "sent", seleccionadaEn: null } }
    );
    throw new Error(`Ya existe una cotización seleccionada para la solicitud ${updated.requestId}`);
  }

  // ── Paso 4: emitir evento y actualizar trazabilidad ──────────
  const ev = _emit("QUOTE_SELECTED", {
    quoteId,
    requestId:   updated.requestId,
    clienteId,
    prestadorId: updated.prestadorId,
    precio:      updated.precio,
    rubroId:     updated.rubroId,
    zonaId:      updated.zonaId,
  }, { actor, context });

  await Quote.findOneAndUpdate(
    { quoteId },
    {
      $set: { ultimoEventoId: ev.event_id, ultimoEventoTipo: "QUOTE_SELECTED" },
      $inc: { version: 1 },
    }
  );

  return { quoteId, eventId: ev.event_id };
}

module.exports = { init, createQuote, sendQuote, updateQuote, expireQuote, withdrawQuote, selectQuote };
