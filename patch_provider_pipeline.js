const fs = require("fs");

// --- 1. Eventos SINAPSIS para Provider Activation ---
const providerEvents = `
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
`;

fs.writeFileSync("shared/events/provider-events.js", providerEvents);
console.log("OK shared/events/provider-events.js");

// --- 2. Modelo: onboardingStep + providerState en Usuario ---
let usuario = fs.readFileSync("src/core/models/Usuario.js", "utf8");
if (!usuario.includes("onboardingStep")) {
  usuario = usuario.replace(
    "  fcmToken:     { type: String, default: null },",
    `  fcmToken:     { type: String, default: null },

  // ── PROVIDER ACTIVATION FSM ──────────────────────────────
  onboardingStep:   { type: String, default: null },
  providerState:    { type: String, enum: ["NONE","ONBOARDING","ACTIVE_PROVIDER","SUSPENDED"], default: "NONE" },
  providerCategory: { type: String, default: null },
  serviceZone:      { type: String, default: null },`
  );
  fs.writeFileSync("src/core/models/Usuario.js", usuario);
  console.log("OK Usuario.js extendido con FSM provider");
} else { console.log("Usuario.js ya tiene onboardingStep"); }

// --- 3. Rutas: /api/onboarding/provider ---
const onboardingRoute = `const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");
const { emitProviderOnboardingStarted, emitProviderProfileCompleted, emitProviderActivated } = require("../../../shared/events/provider-events");

function getUser(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch(e) { return null; }
}

// POST /api/onboarding/provider/start
router.post("/start", async (req, res) => {
  try {
    const payload = getUser(req);
    if (!payload) return res.status(401).json({ ok: false, error: "No autorizado" });
    const userId = payload.id || payload.userId;
    const u = await Usuario.findById(userId);
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    // Idempotente: si ya está en onboarding o activo, devolver estado actual
    if (u.providerState === "ACTIVE_PROVIDER") return res.json({ ok: true, state: "ACTIVE_PROVIDER", message: "Ya sos prestador activo" });
    if (u.providerState === "ONBOARDING") return res.json({ ok: true, state: "ONBOARDING", onboardingStep: u.onboardingStep || "category" });

    // Emitir evento + actualizar estado
    const evt = emitProviderOnboardingStarted({ userId, source: req.body.source || "app" });
    try {
      const { router: eventRouter } = require("../../../shared/events/router-instance");
      await eventRouter.publish(evt);
    } catch(e) { console.warn("[Onboarding] eventRouter no disponible:", e.message); }

    await Usuario.findByIdAndUpdate(userId, {
      rol: "TRABAJADOR",
      roles: [...new Set([...(u.roles || []), "TRABAJADOR"])],
      providerState: "ONBOARDING",
      onboardingStep: "category"
    });

    res.json({ ok: true, state: "ONBOARDING", onboardingStep: "category", message: "Onboarding iniciado" });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/onboarding/provider/complete
router.post("/complete", async (req, res) => {
  try {
    const payload = getUser(req);
    if (!payload) return res.status(401).json({ ok: false, error: "No autorizado" });
    const userId = payload.id || payload.userId;
    const { category, serviceZone, pricingModel, availability } = req.body;
    if (!category || !serviceZone) return res.status(400).json({ ok: false, error: "category y serviceZone son requeridos" });

    const u = await Usuario.findById(userId);
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    // Emitir profile completed
    const evtProfile = emitProviderProfileCompleted({ userId, category, serviceZone, pricingModel, availability });
    const evtActivated = emitProviderActivated({ userId, category, serviceZone });
    try {
      const { router: eventRouter } = require("../../../shared/events/router-instance");
      await eventRouter.publish(evtProfile);
      await eventRouter.publish(evtActivated);
    } catch(e) { console.warn("[Onboarding] eventos no publicados:", e.message); }

    await Usuario.findByIdAndUpdate(userId, {
      providerState: "ACTIVE_PROVIDER",
      onboardingStep: null,
      rubro: category,
      serviceZone,
      especialidades: [category],
      disponible: true
    });

    res.json({ ok: true, state: "ACTIVE_PROVIDER", message: "Prestador activado. Ya podés recibir consultas." });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
`;

fs.writeFileSync("src/core/routes/onboardingRoutes.js", onboardingRoute);
console.log("OK src/core/routes/onboardingRoutes.js");

// --- 4. Montar rutas en server.js ---
let server = fs.readFileSync("server.js", "utf8");
if (!server.includes("onboardingRoutes")) {
  server = server.replace(
    "app.use('/api/auth', require('./src/core/routes/auth'));",
    "app.use('/api/auth', require('./src/core/routes/auth'));\napp.use('/api/onboarding/provider', require('./src/core/routes/onboardingRoutes'));"
  );
  fs.writeFileSync("server.js", server);
  console.log("OK onboardingRoutes montado en server.js");
} else { console.log("onboardingRoutes ya montado"); }

console.log("Pipeline completo");
