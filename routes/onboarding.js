const express = require('express');
const router = express.Router();
const QRCodeCampaign = require('../models/QRCodeCampaign');
const OnboardingSession = require('../models/OnboardingSession');
const { verifyQRToken, newSessionId } = require('../services/qr/qrTokenService');
const { emitQRScanned, emitQRRejected, emitOnboardingSessionCreated } = require('../shared/events/commerce-events');
const authMiddleware = require('../middleware/authMiddleware');
const { transition, InvalidTransitionError } = require('../services/onboarding/sessionFSM');

const SESSION_TTL_MINUTES = 15;

async function publish(evt) {
  try {
    const { router: eventRouter } = require('../shared/events/router-instance');
    await eventRouter.publish(evt);
    return evt;
  } catch (e) {
    console.warn('[SQOP] eventRouter no disponible:', e.message);
    return evt;
  }
}

router.get('/o', async (req, res) => {
  const { token } = req.query;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';

  if (!token) return res.status(400).send('Token QR faltante');

  const { valid, payload, reason } = verifyQRToken(token);

  if (!valid) {
    await publish(emitQRRejected({ token, reason, ip, userAgent }));
    return res.status(403).send('QR inválido o expirado');
  }

  const { ref, campaign, region, scope, channel, qrId } = payload;

  const campaignDoc = await QRCodeCampaign.findOne({ ref, campaign, active: true });
  if (!campaignDoc || campaignDoc.expiresAt < new Date()) {
    return res.status(403).send('Campaña inactiva o expirada');
  }

  if (qrId && campaignDoc.revokedQrIds.includes(qrId)) {
    await publish(emitQRRejected({ token, reason: 'qr_revoked', qrId, ip, userAgent }));
    return res.status(403).send('Este QR fue revocado');
  }

  const qrScannedEvent = await publish(emitQRScanned({ ref, campaign, region, scope, channel, qrId, ip, userAgent }));

  campaignDoc.scansCount += 1;
  await campaignDoc.save();

  const sessionId = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  await OnboardingSession.create({ sessionId, ref, campaign, qrId, status: 'pending', ip, userAgent, expiresAt });

  await publish(emitOnboardingSessionCreated({ sessionId, ref, campaign, qrId, expiresAt, qrScannedEvent }));

  return res.redirect(`/qr/onboarding?session=${sessionId}`);
});

router.get('/api/onboarding/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = await OnboardingSession.findOne({ sessionId });

  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (session.expiresAt < new Date() && session.status !== 'expired') {
    transition(session, 'expired');
    await session.save();
  }
  if (session.status === 'expired') {
    return res.status(410).json({ error: 'Sesión expirada' });
  }
  if (session.status === 'pending') {
    transition(session, 'validated');
    await session.save();
  }

  return res.json({ sessionId: session.sessionId, campaign: session.campaign, status: session.status });
});

// POST /api/onboarding/session/:sessionId/auth
// Transicion validated -> authenticated. Vincula el usuario ya autenticado
// (via authMiddleware) a la sesion de onboarding QR. No publica evento en
// el bus canonico: la FSM de OnboardingSession es estado interno, no un
// hecho de dominio (ver docs/RFC-onboarding-merchant-fsm.md).
router.post('/api/onboarding/session/:sessionId/auth', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const session = await OnboardingSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (session.expiresAt < new Date() && session.status !== 'expired') {
      transition(session, 'expired');
      await session.save();
    }
    if (session.status === 'expired') {
      return res.status(410).json({ error: 'Sesión expirada' });
    }

    // Idempotencia: si ya esta autenticada por el MISMO usuario, no es
    // un error, es un retry (doble click, reintento de red, etc.)
    if (session.status === 'authenticated' && String(session.usuarioId) === String(req.userId)) {
      return res.json({ sessionId: session.sessionId, status: session.status, usuarioId: session.usuarioId });
    }

    // Proteccion de ownership: una sesion QR ya vinculada a OTRO usuario
    // no puede ser reclamada por un usuario distinto (evita secuestro de
    // sesion si el sessionId se filtra o se comparte por error).
    if (session.usuarioId && String(session.usuarioId) !== String(req.userId)) {
      return res.status(409).json({ error: 'Sesión ya vinculada a otro usuario' });
    }

    try {
      transition(session, 'authenticated');
    } catch (e) {
      if (e instanceof InvalidTransitionError) {
        return res.status(409).json({ error: e.message, from: e.from, to: e.to });
      }
      throw e;
    }

    session.usuarioId = req.userId;
    await session.save();

    return res.json({ sessionId: session.sessionId, status: session.status, usuarioId: session.usuarioId });
  } catch (e) {
    console.error('[onboarding] /auth error:', e);
    return res.status(500).json({ error: 'Error interno al autenticar sesión' });
  }
});

// POST /api/onboarding/session/:sessionId/complete
// Transicion profile_created -> completed. Cierra la FSM del onboarding
// QR. No publica evento en el bus canonico (mismo criterio que /auth).
router.post('/api/onboarding/session/:sessionId/complete', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await OnboardingSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    if (session.expiresAt < new Date() && session.status !== 'expired') {
      transition(session, 'expired');
      await session.save();
    }
    if (session.status === 'expired') {
      return res.status(410).json({ error: 'Sesión expirada' });
    }

    // Idempotencia: si ya esta completed, devolver el estado actual.
    if (session.status === 'completed') {
      return res.json({ sessionId: session.sessionId, status: session.status, completedAt: session.completedAt });
    }

    if (session.usuarioId && String(session.usuarioId) !== String(req.userId)) {
      return res.status(409).json({ error: 'Sesión ya vinculada a otro usuario' });
    }

    if (!session.commerceId) {
      return res.status(409).json({ error: 'La sesión no tiene un comercio vinculado aún' });
    }

    try {
      transition(session, 'completed');
    } catch (e) {
      if (e instanceof InvalidTransitionError) {
        return res.status(409).json({ error: e.message, from: e.from, to: e.to });
      }
      throw e;
    }

    session.completedAt = new Date();
    await session.save();

    return res.json({ sessionId: session.sessionId, status: session.status, completedAt: session.completedAt });
  } catch (e) {
    console.error('[onboarding] /complete error:', e);
    return res.status(500).json({ error: 'Error interno al completar sesión' });
  }
});

module.exports = router;
