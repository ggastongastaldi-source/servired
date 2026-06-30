/**
 * routes/quotes.js — API del agregado Quote
 *
 * Comandos (escritura):
 *   POST   /api/quotes                  → createQuote
 *   POST   /api/quotes/:id/send         → sendQuote
 *   PATCH  /api/quotes/:id              → updateQuote
 *   POST   /api/quotes/:id/withdraw     → withdrawQuote
 *   POST   /api/quotes/:id/select       → selectQuote
 *   POST   /api/quotes/:id/expire       → expireQuote (admin/cron)
 *
 * Consultas (lectura):
 *   GET    /api/quotes/:id                        → quote individual
 *   GET    /api/requests/:requestId/quotes        → todas las quotes de un request
 *   GET    /api/auction-outcomes/:requestId       → outcome de la subasta
 *
 * Auth: requireAuth en comandos, lectura pública por ahora.
 * El quoteService recibe actor y context del request autenticado.
 */
"use strict";

const express = require("express");
const router  = express.Router();

const quoteService     = require("../services/quote/quoteService");
const QuoteRouterAdapter = require("../runtime/QuoteRouterAdapter");
quoteService.init(QuoteRouterAdapter);
const Quote            = require("../models/Quote");
const AuctionOutcome   = require("../models/AuctionOutcome");

// Middleware de auth — reutilizar el existente en ServiRed
// Si el proyecto usa un nombre distinto, ajustar el require.
let requireAuth;
try {
  requireAuth = require("../src/core/middleware/auth").verificarToken;
  if (typeof requireAuth !== "function") throw new Error("verificarToken no exportado");
} catch (e) {
  console.warn("[quotes] middleware/auth no encontrado — endpoints sin protección:", e.message);
  requireAuth = (_req, _res, next) => next();
}

// ── Helper de respuesta ──────────────────────────────────────────
function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

function fail(res, message, status = 400) {
  return res.status(status).json({ ok: false, error: message });
}

// ── Contexto desde request ───────────────────────────────────────
function buildContext(req) {
  return {
    zone:   req.body?.zonaId || null,
    source: "api/quotes",
  };
}

function buildActor(req) {
  // req.user es lo que deja el middleware de auth de ServiRed
  const user = req.user || {};
  return {
    user_id: String(user._id || user.id || "anonymous"),
    role:    user.rol || user.role || "anonymous",
  };
}

// ════════════════════════════════════════════════════════════════
// COMANDOS
// ════════════════════════════════════════════════════════════════

/**
 * POST /api/quotes
 * Body: { requestId, prestadorId, clienteId, precio, descripcion?,
 *         validezHasta?, rubroId?, zonaId? }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { requestId, prestadorId, clienteId, precio, descripcion, validezHasta, rubroId, zonaId } = req.body;

    if (!requestId)   return fail(res, "requestId requerido");
    if (!prestadorId) return fail(res, "prestadorId requerido");
    if (!clienteId)   return fail(res, "clienteId requerido");
    if (!precio || isNaN(Number(precio))) return fail(res, "precio requerido y debe ser numérico");

    const result = await quoteService.createQuote({
      requestId,
      prestadorId,
      clienteId,
      precio: Number(precio),
      descripcion,
      validezHasta,
      rubroId,
      zonaId,
      actor:   buildActor(req),
      context: buildContext(req),
    });

    return ok(res, result, 201);
  } catch (err) {
    console.error("[POST /api/quotes]", err.message);
    return fail(res, err.message, 500);
  }
});

/**
 * POST /api/quotes/:id/send
 */
router.post("/:id/send", requireAuth, async (req, res) => {
  try {
    const result = await quoteService.sendQuote({
      quoteId: req.params.id,
      actor:   buildActor(req),
      context: buildContext(req),
    });
    return ok(res, result);
  } catch (err) {
    console.error("[POST /api/quotes/:id/send]", err.message);
    const status = err.message.includes("no puede") ? 409 : 500;
    return fail(res, err.message, status);
  }
});

/**
 * PATCH /api/quotes/:id
 * Body: { precio?, descripcion?, validezHasta? }
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { precio, descripcion, validezHasta } = req.body;

    if (precio !== undefined && isNaN(Number(precio))) {
      return fail(res, "precio debe ser numérico");
    }

    const result = await quoteService.updateQuote({
      quoteId: req.params.id,
      precio:  precio !== undefined ? Number(precio) : undefined,
      descripcion,
      validezHasta,
      actor:   buildActor(req),
      context: buildContext(req),
    });
    return ok(res, result);
  } catch (err) {
    console.error("[PATCH /api/quotes/:id]", err.message);
    const status = err.message.includes("no puede") ? 409 : 500;
    return fail(res, err.message, status);
  }
});

/**
 * POST /api/quotes/:id/withdraw
 */
router.post("/:id/withdraw", requireAuth, async (req, res) => {
  try {
    const result = await quoteService.withdrawQuote({
      quoteId: req.params.id,
      actor:   buildActor(req),
      context: buildContext(req),
    });
    return ok(res, result);
  } catch (err) {
    console.error("[POST /api/quotes/:id/withdraw]", err.message);
    const status = err.message.includes("no puede") ? 409 : 500;
    return fail(res, err.message, status);
  }
});

/**
 * POST /api/quotes/:id/select
 * Identidad desde req.user — nunca desde body.
 * Verifica ownership: quote.clienteId === req.user._id
 */
router.post("/:id/select", requireAuth, async (req, res) => {
  try {
    console.log("[DEBUG select] req.user:", JSON.stringify(req.user));
    const userId = req.user?._id || req.user?.id || req.user?.userId;
    if (!userId) return fail(res, "Sesión inválida", 401);

    const QuoteModel = require("../models/Quote");
    const quote = await QuoteModel.findOne({ quoteId: req.params.id }).lean();
    if (!quote) return fail(res, "Quote no encontrada", 404);

    if (String(quote.clienteId) !== String(userId)) {
      return fail(res, "No autorizado: esta cotización no pertenece a tu solicitud", 403);
    }

    const result = await quoteService.selectQuote({
      quoteId:   req.params.id,
      clienteId: String(userId),
      actor:     buildActor(req),
      context:   buildContext(req),
    });

    return ok(res, result, 200);
  } catch (err) {
    console.error("[POST /api/quotes/:id/select]", err.message);
    const isConflict = err.message.includes("no puede") ||
                       err.message.includes("no disponible") ||
                       err.message.includes("ya existe");
    return fail(res, err.message, isConflict ? 409 : 500);
  }
});

/**
 * POST /api/quotes/:id/expire  (admin / cron)
 */
router.post("/:id/expire", requireAuth, async (req, res) => {
  try {
    const result = await quoteService.expireQuote({
      quoteId: req.params.id,
      context: buildContext(req),
    });
    if (!result) return ok(res, { message: "Quote ya resuelta, expire ignorado" });
    return ok(res, result);
  } catch (err) {
    console.error("[POST /api/quotes/:id/expire]", err.message);
    return fail(res, err.message, 500);
  }
});

// ════════════════════════════════════════════════════════════════
// CONSULTAS (lectura)
// ════════════════════════════════════════════════════════════════

/**
 * GET /api/quotes/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const quote = await Quote.findOne({ quoteId: req.params.id }).lean();
    if (!quote) return fail(res, "Quote no encontrada", 404);
    return ok(res, { quote });
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * GET /api/requests/:requestId/quotes
 * Montado en server.js como /api/requests/:requestId/quotes
 * pero también disponible aquí para uso interno
 */
router.get("/by-request/:requestId", async (req, res) => {
  try {
    const quotes = await Quote.find({ requestId: req.params.requestId })
      .sort({ creadaEn: 1 })
      .lean();
    return ok(res, { quotes, total: quotes.length });
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * GET /api/auction-outcomes/:requestId
 */
router.get("/auction-outcome/:requestId", async (req, res) => {
  try {
    const outcome = await AuctionOutcome.findOne({ requestId: req.params.requestId }).lean();
    if (!outcome) return fail(res, "AuctionOutcome no encontrado", 404);
    return ok(res, { outcome });
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

module.exports = router;
