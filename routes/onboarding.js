const express = require('express');
const router = express.Router();
const QRCodeCampaign = require('../models/QRCodeCampaign');
const OnboardingSession = require('../models/OnboardingSession');
const { verifyQRToken, newSessionId } = require('../services/qr/qrTokenService');
const { registrarEvento } = require('../services/sinapsisBusAdapter'); // AJUSTAR si el path/export real difiere

const SESSION_TTL_MINUTES = 15;

router.get('/o', async (req, res) => {
  const { token } = req.query;
  // ip/userAgent: SOLO auditoría/log. Nunca se usan para decisiones de seguridad
  // (NAT, proxies y redes móviles los vuelven poco confiables como control).
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || '';

  if (!token) return res.status(400).send('Token QR faltante');

  const { valid, payload, reason } = verifyQRToken(token);

  if (!valid) {
    await registrarEvento('QR_REJECTED', { token, reason, ip, userAgent }).catch(() => {});
    return res.status(403).send('QR inválido o expirado');
  }

  const { ref, campaign, region, scope, channel, qrId } = payload;

  const campaignDoc = await QRCodeCampaign.findOne({ ref, campaign, active: true });
  if (!campaignDoc || campaignDoc.expiresAt < new Date()) {
    return res.status(403).send('Campaña inactiva o expirada');
  }

  if (qrId && campaignDoc.revokedQrIds.includes(qrId)) {
    await registrarEvento('QR_REJECTED', { token, reason: 'qr_revoked', qrId, ip, userAgent }).catch(() => {});
    return res.status(403).send('Este QR fue revocado');
  }

  await registrarEvento('QR_SCANNED', {
    ref, campaign, region, scope, channel, qrId, ip, userAgent, timestamp: new Date(),
  }).catch(() => {});

  campaignDoc.scansCount += 1;
  await campaignDoc.save();

  const sessionId = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

  await OnboardingSession.create({ sessionId, ref, campaign, qrId, status: 'pending', ip, userAgent, expiresAt });

  await registrarEvento('ONBOARDING_SESSION_CREATED', { sessionId, ref, campaign, qrId, expiresAt }).catch(() => {});

  // TODO (foreseen, no urgente): mover sessionId a cookie HTTP-only en vez de query param,
  // una vez confirmado que cookie-parser está instalado y wireado en server.js.
  return res.redirect(`/onboarding?session=${sessionId}`);
});

// El frontend NUNCA recibe ref (identificador interno del vendedor).
// Solo lo necesario para renderizar el onboarding.
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
