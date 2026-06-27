const fs = require("fs");

const meRoute = `
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ ok: false, error: "Token requerido" });
    const jwt = require("jsonwebtoken");
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch(e) { return res.status(401).json({ ok: false, error: "Token invalido" }); }
    const u = await Usuario.findById(payload.id || payload.userId).lean();
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    const fields = ["nombre","email","rol"].filter(f => u[f]).length;
    const optional = ["rubro","telefono","direccion"].filter(f => u[f]).length;
    const profileCompletion = parseFloat(Math.min(1, (fields/3)*0.6 + (optional/3)*0.4).toFixed(2));
    let state = "APP_READY";
    if (u.estado === "BLOQUEADO") state = "BLOQUEADO";
    else if (!u.rol || (u.rol === "CLIENTE" && !u.rubro && !(u.especialidades||[]).length)) state = "NUEVO";
    else if (profileCompletion < 1) state = "INCOMPLETO";
    res.json({ ok: true, snapshot: { userId: u._id, state, role: u.rol||null, profileCompletion, needsOnboarding: state==="NUEVO"||state==="INCOMPLETO", onboardingStep: state==="APP_READY"?null:(u.onboardingStep||"rol"), avatar: u.avatar||null, nombre: u.nombre, lastTransitionAt: u.updatedAt?new Date(u.updatedAt).getTime():Date.now() }});
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});
`;

let auth = fs.readFileSync("src/core/routes/auth.js", "utf8");
if (!auth.includes('router.get("/me"')) {
  auth = auth.replace("module.exports = router;", meRoute + "\nmodule.exports = router;");
  fs.writeFileSync("src/core/routes/auth.js", auth);
  console.log("OK /api/auth/me agregado");
} else { console.log("ya existe /me"); }

const appShell = `<script>
async function initAppShell() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const r = await fetch("/api/auth/me", { headers: { "Authorization": "Bearer " + token } });
    const data = await r.json();
    if (!data.ok) { localStorage.removeItem("token"); return; }
    window.__userSnapshot = data.snapshot;
    if (data.snapshot.state === "BLOQUEADO") { document.body.innerHTML = "<div style='display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0e1a;color:#ef4444;font-family:Rajdhani,sans-serif;font-size:1.2rem;'>Cuenta bloqueada. Contacta soporte.</div>"; return; }
    if (data.snapshot.needsOnboarding) { mostrarSeleccionRol(data.snapshot); return; }
    const headerUser = document.getElementById("header-user");
    if (headerUser) { const n = data.snapshot.nombre ? data.snapshot.nombre.split(" ")[0] : ""; headerUser.innerHTML = data.snapshot.avatar ? "<img src='"+data.snapshot.avatar+"' style='width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:6px;'>"+n : n; }
  } catch(e) { console.warn("[AppShell]", e.message); }
}
document.addEventListener("DOMContentLoaded", initAppShell);
</script>`;

let html = fs.readFileSync("public/index.html", "utf8");
if (!html.includes("initAppShell")) {
  html = html.replace("</body>", appShell + "\n</body>");
  fs.writeFileSync("public/index.html", html);
  console.log("OK AppShell agregado");
} else { console.log("AppShell ya existe"); }
