
// ── PROVIDER ACTIVATION EVENTS ──────────────────────────────
const PROVIDER_EVENTS = {
  ONBOARDING_STARTED:   "PROVIDER_ONBOARDING_STARTED",
  PROFILE_COMPLETED:    "PROVIDER_PROFILE_COMPLETED",
  ACTIVATED:            "PROVIDER_ACTIVATED",
  ONBOARDING_ABANDONED: "PROVIDER_ONBOARDING_ABANDONED"
};

function emitProviderOnboardingStarted({ userId, source }) {
  return {
    event_type: PROVIDER_EVENTS.ONBOARDING_STARTED,
    aggregate_id: String(userId),
    aggregate_type: "Provider",
    payload: { userId: String(userId), role: "TRABAJADOR", source: source || "app", status: "in_progress" },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

function emitProviderProfileCompleted({ userId, category, serviceZone, pricingModel, availability }) {
  return {
    event_type: PROVIDER_EVENTS.PROFILE_COMPLETED,
    aggregate_id: String(userId),
    aggregate_type: "Provider",
    payload: { userId: String(userId), category, serviceZone, pricingModel: pricingModel || "fixed", availability: availability || "immediate" },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

function emitProviderActivated({ userId, category, serviceZone }) {
  return {
    event_type: PROVIDER_EVENTS.ACTIVATED,
    aggregate_id: String(userId),
    aggregate_type: "Provider",
    payload: { userId: String(userId), category, serviceZone, activatedAt: new Date().toISOString() },
    metadata: { timestamp: new Date().toISOString(), version: "1.0" }
  };
}

module.exports = { PROVIDER_EVENTS, emitProviderOnboardingStarted, emitProviderProfileCompleted, emitProviderActivated };
