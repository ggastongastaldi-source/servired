const express = require("express");
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
