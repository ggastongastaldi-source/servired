'use strict';
/**
 * legal.js — API de gobernanza legal del MOS
 *
 * GET  /api/legal/documents          — documentos activos (público)
 * GET  /api/legal/documents/:type    — documento activo por tipo (público)
 * POST /api/legal/consent            — registrar aceptación (requiere auth)
 * GET  /api/legal/compliance         — estado de cumplimiento del usuario (requiere auth)
 */
const express = require('express');
const router  = express.Router();
const { LegalDocument, getActiveDocument }  = require('../models/LegalDocument');
const { checkUserCompliance }               = require('../models/UserConsent');
const { recordConsentBatch }                = require('../services/legalConsentService');
const authMiddleware                        = require('../middleware/auth');

// ── GET /api/legal/documents — todos los activos (para menú hamburguesa) ─────
router.get('/documents', async (req, res) => {
  try {
    const docs = await LegalDocument.find({ status: 'active' })
      .select('type version title effectiveAt requiredFor')
      .lean();
    res.json({ ok: true, documents: docs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/legal/documents/:type — documento completo por tipo ──────────────
router.get('/documents/:type', async (req, res) => {
  try {
    const doc = await getActiveDocument(req.params.type);
    if (!doc) return res.status(404).json({ ok: false, error: 'Documento no encontrado' });
    res.json({ ok: true, document: doc });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/legal/consent — registrar aceptaciones ─────────────────────────
router.post('/consent', authMiddleware, async (req, res) => {
  try {
    const userId       = req.user._id || req.user.id;
    const { documentTypes, context } = req.body;

    if (!Array.isArray(documentTypes) || documentTypes.length === 0)
      return res.status(400).json({ ok: false, error: 'documentTypes requerido (array)' });

    const ip        = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'] || null;

    const result = await recordConsentBatch({
      userId,
      documentTypes,
      ip,
      userAgent,
      context: context || 'registration',
    });

    res.json({ ok: result.ok, total: result.total, fresh: result.fresh, results: result.results.map(r => ({
      documentType:    r.consent.documentType,
      version:         r.consent.version,
      alreadyAccepted: r.alreadyAccepted,
      acceptedAt:      r.consent.acceptedAt,
    }))});
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/legal/compliance — qué documentos le faltan al usuario ───────────
router.get('/compliance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const role   = req.user.role || req.user.actorRole || 'cliente';
    const result = await checkUserCompliance(userId, role);
    res.json({
      ok:      result.ok,
      pending: result.pending.map(d => ({ type: d.type, version: d.version, title: d.title })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
