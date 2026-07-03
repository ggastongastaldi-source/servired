const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const QR_SECRET = process.env.QR_TOKEN_SECRET || process.env.JWT_SECRET;

function generateQRToken({ ref, campaign, region = 'AMBA', scope = 'onboarding_commerce', channel = 'offline_qr', ttlDays = 30, qrId = null }) {
  if (!ref || !campaign) throw new Error('ref y campaign son requeridos');
  const finalQrId = qrId || crypto.randomUUID();
  const payload = { ref, campaign, region, scope, channel, qrId: finalQrId };
  const token = jwt.sign(payload, QR_SECRET, { expiresIn: `${ttlDays}d` });
  return { token, qrId: finalQrId };
}

function verifyQRToken(token) {
  try {
    const decoded = jwt.verify(token, QR_SECRET);
    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

function newSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { generateQRToken, verifyQRToken, newSessionId };
