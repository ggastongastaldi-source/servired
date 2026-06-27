const fs = require("fs");

let route = fs.readFileSync("src/core/routes/onboardingRoutes.js", "utf8");

// 1. Agregar require de idempotency al inicio
if (route.indexOf("sep/idempotency") === -1) {
  route = route.replace(
    'const express = require("express");',
    'const express = require("express");\nconst idem = require("../../../src/sep/idempotency");'
  );
}

// 2. Patch /start con idempotencia
const startViejo = `  // Idempotente: si ya está en onboarding o activo, devolver estado actual
    if (u.providerState === "ACTIVE_PROVIDER") return res.json({ ok: true, state: "ACTIVE_PROVIDER", message: "Ya sos prestador activo" });
    if (u.providerState === "ONBOARDING") return res.json({ ok: true, state: "ONBOARDING", onboardingStep: u.onboardingStep || "category" });

    // Emitir evento + actualizar estado`;

const startNuevo = `  // Idempotencia SEP
    const idemKey = "onboarding:start:" + userId;
    const lock = await idem.acquire(idemKey);
    if (!lock.acquired) {
      if (lock.existing && lock.existing.status === "DONE") return res.json(lock.existing.result);
      return res.json({ ok: true, state: "ONBOARDING", onboardingStep: u.onboardingStep || "category", cached: true });
    }
    await idem.markProcessing(idemKey);

    // FSM guard
    if (u.providerState === "ACTIVE_PROVIDER") {
      const r = { ok: true, state: "ACTIVE_PROVIDER", message: "Ya sos prestador activo" };
      await idem.markDone(idemKey, r);
      return res.json(r);
    }
    if (u.providerState === "ONBOARDING") {
      await idem.markDone(idemKey, { ok: true, state: "ONBOARDING" });
      return res.json({ ok: true, state: "ONBOARDING", onboardingStep: u.onboardingStep || "category" });
    }

    // Emitir evento + actualizar estado`;

if (route.indexOf(startViejo) !== -1) {
  route = route.replace(startViejo, startNuevo);
  console.log("OK /start idempotencia aplicada");
} else { console.log("WARN: patron /start no encontrado"); }

// 3. Patch /complete con idempotencia
const completeViejo = `    const u = await Usuario.findById(userId);
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    // Emitir profile completed`;

const completeNuevo = `    const u = await Usuario.findById(userId);
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    // Idempotencia SEP
    const idemKey = "onboarding:complete:" + userId;
    const lock = await idem.acquire(idemKey);
    if (!lock.acquired) {
      if (lock.existing && lock.existing.status === "DONE") return res.json(lock.existing.result);
      return res.json({ ok: true, state: "PROCESSING", message: "Activacion en curso" });
    }
    await idem.markProcessing(idemKey);

    // Emitir profile completed`;

if (route.indexOf(completeViejo) !== -1) {
  route = route.replace(completeViejo, completeNuevo);
  console.log("OK /complete idempotencia aplicada");
} else { console.log("WARN: patron /complete no encontrado"); }

// 4. Wrap markDone en el res.json final de /complete
const completeResViejo = `    res.json({ ok: true, state: "ACTIVE_PROVIDER", message: "Prestador activado. Ya podés recibir consultas." });`;
const completeResNuevo = `    const activationResult = { ok: true, state: "ACTIVE_PROVIDER", message: "Prestador activado. Ya podés recibir consultas." };
    await idem.markDone(idemKey, activationResult).catch(()=>{});
    res.json(activationResult);`;

if (route.indexOf(completeResViejo) !== -1) {
  route = route.replace(completeResViejo, completeResNuevo);
  console.log("OK markDone en /complete");
} else { console.log("WARN: patron res.json /complete no encontrado"); }

fs.writeFileSync("src/core/routes/onboardingRoutes.js", route);
console.log("onboardingRoutes.js actualizado");
