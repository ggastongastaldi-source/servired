
// ── COMMERCE QR ONBOARDING EVENTS (SQOP v1) ─────────────────
const COMMERCE_EVENTS = {
  QR_SCANNED:                  "COMMERCE_QR_SCANNED",
  QR_REJECTED:                 "COMMERCE_QR_REJECTED",
  ONBOARDING_SESSION_CREATED:  "COMMERCE_ONBOARDING_SESSION_CREATED",
  VENDOR_COMMISSION_ASSIGNED:  "VENDOR_COMMISSION_ASSIGNED"
};

function emitQRScanned({ ref, campaign, region, scope, channel, qrId, ip, userAgent }) {
  return {
    event_type: COMMERCE_EVENTS.QR_SCANNED,
    aggregate_id: String(ref),
    aggregate_type: "QRCampaign",
    payload: { ref, campaign, region, scope, channel, qrId, ip, userAgent },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

function emitQRRejected({ token, reason, qrId, ip, userAgent }) {
  return {
    event_type: COMMERCE_EVENTS.QR_REJECTED,
    aggregate_id: qrId || "unknown",
    aggregate_type: "QRCampaign",
    payload: { token, reason, qrId, ip, userAgent },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

function emitOnboardingSessionCreated({ sessionId, ref, campaign, qrId, expiresAt }) {
  return {
    event_type: COMMERCE_EVENTS.ONBOARDING_SESSION_CREATED,
    aggregate_id: String(sessionId),
    aggregate_type: "OnboardingSession",
    payload: { sessionId, ref, campaign, qrId, expiresAt },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

function emitVendorCommissionAssigned({ vendorId, commerceId, sessionId, qrId, commissionRule, status }) {
  return {
    event_type: COMMERCE_EVENTS.VENDOR_COMMISSION_ASSIGNED,
    aggregate_id: String(vendorId),
    aggregate_type: "Vendor",
    payload: { vendorId, commerceId, sessionId, qrId, commissionRule, status },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

module.exports = {
  COMMERCE_EVENTS,
  emitQRScanned,
  emitQRRejected,
  emitOnboardingSessionCreated,
  emitVendorCommissionAssigned
};
