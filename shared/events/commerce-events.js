const crypto = require('crypto');

// Mapeo SQOP -> enum canonico real de event.schema.json (no se toca el schema compartido).
// qr_scanned y lead_attributed ya existian en el enum; register_started y case_abandoned
// se reusan por afinidad semantica en vez de agregar valores nuevos al contrato.
const COMMERCE_EVENT_TYPES = {
  QR_SCANNED: 'qr_scanned',
  QR_REJECTED: 'case_abandoned',
  ONBOARDING_SESSION_CREATED: 'register_started',
  VENDOR_COMMISSION_ASSIGNED: 'lead_attributed',
};

const TENANT_ID = 'servired'; // TODO: confirmar con Gaston si hay multi-tenant real
const ENVIRONMENT = process.env.NODE_ENV || 'production';

function buildEnvelope({ event_type, payload, actor, context, causation }) {
  return {
    event_id: crypto.randomUUID(),
    event_type,
    timestamp: new Date().toISOString(),
    correlation_id: (context && context.session_id) || crypto.randomUUID(),
    causation: causation || { event_id: null, event_type: null },
    actor: {
      user_id: (actor && actor.user_id) || null,
      role: (actor && actor.role) || 'vendor',
    },
    context: {
      tenant_id: TENANT_ID,
      session_id: (context && context.session_id) || null,
      zone: (context && context.zone) || null,
      source: (context && context.source) || 'offline_qr',
    },
    payload: payload || {},
    metadata: { version: 1, environment: ENVIRONMENT },
  };
}

function emitQRScanned({ ref, campaign, region, scope, channel, qrId, ip, userAgent }) {
  return buildEnvelope({
    event_type: COMMERCE_EVENT_TYPES.QR_SCANNED,
    payload: { ref, campaign, region, scope, channel, qrId, ip, userAgent },
    actor: { user_id: ref, role: 'vendor' },
    context: { zone: region, source: channel },
  });
}

function emitQRRejected({ token, reason, qrId, ip, userAgent }) {
  return buildEnvelope({
    event_type: COMMERCE_EVENT_TYPES.QR_REJECTED,
    payload: { token, reason, qrId, ip, userAgent },
    actor: { user_id: null, role: 'unknown' },
    context: { source: 'offline_qr' },
  });
}

function emitOnboardingSessionCreated({ sessionId, ref, campaign, qrId, expiresAt, qrScannedEvent }) {
  return buildEnvelope({
    event_type: COMMERCE_EVENT_TYPES.ONBOARDING_SESSION_CREATED,
    payload: { sessionId, ref, campaign, qrId, expiresAt },
    actor: { user_id: ref, role: 'vendor' },
    context: { session_id: sessionId, source: 'offline_qr' },
    causation: qrScannedEvent
      ? { event_id: qrScannedEvent.event_id, event_type: qrScannedEvent.event_type }
      : null,
  });
}

function emitVendorCommissionAssigned({ vendorId, commerceId, sessionId, qrId, commissionRule, status }) {
  return buildEnvelope({
    event_type: COMMERCE_EVENT_TYPES.VENDOR_COMMISSION_ASSIGNED,
    payload: { vendorId, commerceId, sessionId, qrId, commissionRule, status },
    actor: { user_id: vendorId, role: 'vendor' },
    context: { session_id: sessionId, source: 'offline_qr' },
  });
}

module.exports = {
  COMMERCE_EVENT_TYPES,
  emitQRScanned,
  emitQRRejected,
  emitOnboardingSessionCreated,
  emitVendorCommissionAssigned,
};
