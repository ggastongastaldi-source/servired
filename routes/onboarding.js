const express = require('express');
const router = express.Router();
const QRCodeCampaign = require('../models/QRCodeCampaign');
const OnboardingSession = require('../models/OnboardingSession');
const { verifyQRToken, newSessionId } = require('../services/qr/qrTokenService');
const { emitQRScanned, emitQRRejected, emitOnboardingSessionCreated } = require('../shared/events/commerce-events');

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
  if (session.status === 'expired' || session.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Sesión expirada' });
  }
  if (session.status === 'pending') {
    session.status = 'validated';
    await session.save();
  }

  return res.json({ sessionId: session.sessionId, campaign: session.campaign, status: session.status });
});

module.exports = router;
