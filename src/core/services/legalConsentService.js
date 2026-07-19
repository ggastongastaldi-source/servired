'use strict';
const { LegalDocument } = require('../models/LegalDocument');
const { UserConsent }   = require('../models/UserConsent');
const { trackEvent }    = require('./trackEvent');

async function recordConsent({ userId, documentType, ip, userAgent, context = 'registration' }) {
  const doc = await LegalDocument.findOne({ type: documentType, status: 'active' }).lean();
  if (!doc) throw new Error(`No hay documento activo de tipo '${documentType}'`);

  const existing = await UserConsent.findOne({ userId, documentId: doc._id }).lean();
  if (existing) return { ok: true, consent: existing, alreadyAccepted: true };

  const consent = await UserConsent.create({
    userId, documentId: doc._id, documentType: doc.type,
    version: doc.version, contentHash: doc.contentHash,
    acceptedAt: new Date(), ip: ip || null, userAgent: userAgent || null, context,
  });

  trackEvent('LEGAL_CONSENT_RECORDED', {
    actorId: userId, actorRole: 'sistema',
    meta: { documentType, version: doc.version, contentHash: doc.contentHash,
            consentId: consent._id.toString(), context },
  });

  return { ok: true, consent, alreadyAccepted: false };
}

async function recordConsentBatch({ userId, documentTypes, ip, userAgent, context = 'registration' }) {
  const results = await Promise.all(
    documentTypes.map(type => recordConsent({ userId, documentType: type, ip, userAgent, context }))
  );
  return { ok: results.every(r => r.ok), results, total: results.length,
           fresh: results.filter(r => !r.alreadyAccepted).length };
}

module.exports = { recordConsent, recordConsentBatch };
