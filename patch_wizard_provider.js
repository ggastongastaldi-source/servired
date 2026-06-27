const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

// 1. Reemplazar elegirRol TRABAJADOR para que llame al wizard
const rolViejoTrabajador = `  else if (rol === "TRABAJADOR") { window.location.href = "/registro-trabajador.html"; }`;
const rolNuevoTrabajador = `  else if (rol === "TRABAJADOR") { iniciarWizardProvider(document.getElementById("rol-selector-overlay")); }`;
if (html.includes(rolViejoTrabajador)) {
  html = html.replace(rolViejoTrabajador, rolNuevoTrabajador);
  console.log("OK elegirRol TRABAJADOR actualizado");
} else { console.log("WARN: patron elegirRol TRABAJADOR no encontrado"); }

// 2. Agregar wizard completo antes de </body>
const wizard = `
<script>
// ── WIZARD PROVIDER ─────────────────────────────────────────
async function iniciarWizardProvider(overlayAnterior) {
  if (overlayAnterior) overlayAnterior.remove();
  const token = localStorage.getItem("token");
  // Llamar /start en backend
  try {
    await fetch("/api/onboarding/provider/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ source: "google_oauth" })
    });
  } catch(e) { console.warn("[Wizard] start error:", e.message); }
  mostrarWizardStep(1, {});
}

function mostrarWizardStep(step, data) {
  const existing = document.getElementById("wizard-provider-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "wizard-provider-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,14,26,0.98);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;box-sizing:border-box;overflow-y:auto;";

  const steps = ["Tus datos", "Tu oficio", "Tu zona", "Confirmación"];
  const barra = steps.map((s,i) => {
    const activo = i+1 === step ? "color:#00E5FF;border-bottom:2px solid #00E5FF;" : "color:#374151;border-bottom:2px solid #374151;";
    return "<span style='flex:1;text-align:center;padding-bottom:6px;font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;"+activo+"'>"+s+"</span>";
  }).join("");

  let contenido = "";

  if (step === 1) {
    contenido = `
      <p style="color:#64748b;font-size:0.85rem;margin-bottom:20px;">Primero lo básico. ¿Cómo te llamás y cómo te contactamos?</p>
      <div style="margin-bottom:14px;"><label style="display:block;font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Nombre completo</label>
      <input id="wiz-nombre" type="text" placeholder="Ej: Juan Martínez" style="width:100%;background:#1a2236;border:1px solid #374151;color:#e2e8f0;padding:12px;border-radius:8px;font-size:0.95rem;box-sizing:border-box;" value="${data.nombre||''}"></div>
      <div style="margin-bottom:20px;"><label style="display:block;font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Teléfono</label>
      <input id="wiz-tel" type="tel" placeholder="Ej: 1123456789" style="width:100%;background:#1a2236;border:1px solid #374151;color:#e2e8f0;padding:12px;border-radius:8px;font-size:0.95rem;box-sizing:border-box;" value="${data.telefono||''}"></div>
      <button onclick="wizardNext1()" style="width:100%;background:#FF6D00;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:600;cursor:pointer;">Continuar →</button>`;
  } else if (step === 2) {
    const rubros = ["electricidad","plomeria","gasista","pintura","albanileria","carpinteria","cerrajeria","climatizacion","limpieza","fletes","jardineria","informatica","cctv","herreria","vidriera"];
    const btns = rubros.map(r => {
      const sel = data.category === r ? "background:#FF6D00;color:#fff;border-color:#FF6D00;" : "";
      return "<button onclick=\"wizSelRubro(this,'"+r+"')\" style=\"background:#1a2236;border:1px solid #374151;color:#e2e8f0;padding:10px 12px;border-radius:8px;font-size:0.82rem;cursor:pointer;"+sel+"\">"+r+"</button>";
    }).join("");
    contenido = `
      <p style="color:#64748b;font-size:0.85rem;margin-bottom:16px;">¿Cuál es tu oficio principal?</p>
      <div id="rubro-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">${btns}</div>
      <div id="wiz-rubro-err" style="color:#ef4444;font-size:0.78rem;margin-bottom:10px;display:none;">Seleccioná un oficio para continuar.</div>
      <button onclick="wizardNext2()" style="width:100%;background:#FF6D00;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:600;cursor:pointer;">Continuar →</button>
      <button onclick="mostrarWizardStep(1,window.__wizData)" style="width:100%;background:transparent;color:#64748b;border:none;padding:10px;font-size:0.82rem;cursor:pointer;margin-top:6px;">← Volver</button>`;
  } else if (step === 3) {
    const zonas = ["la_matanza","lomas_de_zamora","quilmes","lanus","moron","tres_de_febrero","merlo","moreno","tigre","san_isidro","avellaneda","san_martin","ezeiza","caba"];
    const btns = zonas.map(z => {
      const label = z.replace(/_/g," ");
      const sel = data.serviceZone === z ? "background:#00E5FF;color:#0a0e1a;border-color:#00E5FF;" : "";
      return "<button onclick=\"wizSelZona(this,'"+z+"')\" style=\"background:#1a2236;border:1px solid #374151;color:#e2e8f0;padding:10px 12px;border-radius:8px;font-size:0.82rem;cursor:pointer;"+sel+"\">"+label+"</button>";
    }).join("");
    contenido = `
      <p style="color:#64748b;font-size:0.85rem;margin-bottom:16px;">¿En qué zona trabajás principalmente?</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">${btns}</div>
      <div id="wiz-zona-err" style="color:#ef4444;font-size:0.78rem;margin-bottom:10px;display:none;">Seleccioná una zona para continuar.</div>
      <button onclick="wizardNext3()" style="width:100%;background:#FF6D00;color:#fff;border:none;padding:14px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:600;cursor:pointer;">Continuar →</button>
      <button onclick="mostrarWizardStep(2,window.__wizData)" style="width:100%;background:transparent;color:#64748b;border:none;padding:10px;font-size:0.82rem;cursor:pointer;margin-top:6px;">← Volver</button>`;
  } else if (step === 4) {
    contenido = `
      <p style="color:#64748b;font-size:0.85rem;margin-bottom:20px;">Revisá tus datos antes de publicarte.</p>
      <div style="background:#111827;border-radius:10px;padding:16px;margin-bottom:20px;">
        <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:0.75rem;">NOMBRE</span><div style="color:#e2e8f0;">${data.nombre||'-'}</div></div>
        <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:0.75rem;">TELÉFONO</span><div style="color:#e2e8f0;">${data.telefono||'-'}</div></div>
        <div style="margin-bottom:8px;"><span style="color:#64748b;font-size:0.75rem;">OFICIO</span><div style="color:#FF6D00;">${data.category||'-'}</div></div>
        <div><span style="color:#64748b;font-size:0.75rem;">ZONA</span><div style="color:#00E5FF;">${(data.serviceZone||'-').replace(/_/g,' ')}</div></div>
      </div>
      <button onclick="wizardCompletar()" style="width:100%;background:#39ff14;color:#0a0e1a;border:none;padding:14px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:700;cursor:pointer;">Publicarme ahora ✓</button>
      <button onclick="mostrarWizardStep(3,window.__wizData)" style="width:100%;background:transparent;color:#64748b;border:none;padding:10px;font-size:0.82rem;cursor:pointer;margin-top:6px;">← Volver</button>`;
  }

  overlay.innerHTML = `
    <div style="max-width:400px;width:100%;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="color:#FF6D00;font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Paso ${step} de 4</div>
        <div style="display:flex;gap:0;">${barra}</div>
      </div>
      ${contenido}
    </div>`;
  document.body.appendChild(overlay);
  window.__wizData = data;
}

function wizSelRubro(btn, rubro) {
  document.querySelectorAll("#rubro-grid button").forEach(b => { b.style.background="#1a2236"; b.style.color="#e2e8f0"; b.style.borderColor="#374151"; });
  btn.style.background="#FF6D00"; btn.style.color="#fff"; btn.style.borderColor="#FF6D00";
  window.__wizData.category = rubro;
}

function wizSelZona(btn, zona) {
  btn.closest("div").querySelectorAll("button").forEach(b => { b.style.background="#1a2236"; b.style.color="#e2e8f0"; b.style.borderColor="#374151"; });
  btn.style.background="#00E5FF"; btn.style.color="#0a0e1a"; btn.style.borderColor="#00E5FF";
  window.__wizData.serviceZone = zona;
}

function wizardNext1() {
  const nombre = document.getElementById("wiz-nombre").value.trim();
  const tel = document.getElementById("wiz-tel").value.trim();
  if (!nombre) { document.getElementById("wiz-nombre").style.borderColor="#ef4444"; return; }
  window.__wizData.nombre = nombre;
  window.__wizData.telefono = tel;
  mostrarWizardStep(2, window.__wizData);
}

function wizardNext2() {
  if (!window.__wizData.category) { document.getElementById("wiz-rubro-err").style.display="block"; return; }
  mostrarWizardStep(3, window.__wizData);
}

function wizardNext3() {
  if (!window.__wizData.serviceZone) { document.getElementById("wiz-zona-err").style.display="block"; return; }
  mostrarWizardStep(4, window.__wizData);
}

async function wizardCompletar() {
  const btn = document.querySelector("#wizard-provider-overlay button");
  if (btn) { btn.disabled = true; btn.textContent = "Publicando..."; }
  const token = localStorage.getItem("token");
  try {
    // Actualizar nombre/tel si cambió
    if (window.__wizData.nombre) {
      await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ nombre: window.__wizData.nombre, telefono: window.__wizData.telefono })
      }).catch(()=>{});
    }
    const r = await fetch("/api/onboarding/provider/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ category: window.__wizData.category, serviceZone: window.__wizData.serviceZone })
    });
    const data = await r.json();
    if (data.ok) {
      mostrarActivacionExitosa(window.__wizData);
    } else {
      alert("Error: " + data.error);
      if (btn) { btn.disabled = false; btn.textContent = "Publicarme ahora ✓"; }
    }
  } catch(e) {
    alert("Error de conexión. Intentá de nuevo.");
    if (btn) { btn.disabled = false; btn.textContent = "Publicarme ahora ✓"; }
  }
}

function mostrarActivacionExitosa(data) {
  const overlay = document.getElementById("wizard-provider-overlay");
  if (overlay) overlay.innerHTML = `
    <div style="max-width:400px;width:100%;text-align:center;padding-top:60px;">
      <div style="font-size:3rem;margin-bottom:16px;">⚡</div>
      <h2 style="color:#39ff14;font-family:Rajdhani,sans-serif;font-size:1.6rem;margin-bottom:8px;">¡Ya estás publicado!</h2>
      <p style="color:#e2e8f0;font-size:0.95rem;margin-bottom:8px;">Tu negocio ya puede recibir consultas en ServiRed.</p>
      <p style="color:#64748b;font-size:0.82rem;margin-bottom:32px;">${(data.category||'').replace(/_/g,' ')} · ${(data.serviceZone||'').replace(/_/g,' ')}</p>
      <button onclick="location.reload()" style="background:#FF6D00;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:600;cursor:pointer;">Ver mi perfil →</button>
    </div>`;
}
</script>
`;

if (!html.includes("iniciarWizardProvider")) {
  html = html.replace("</body>", wizard + "\n</body>");
  console.log("OK wizard provider agregado");
} else { console.log("wizard ya existe"); }

fs.writeFileSync("public/index.html", html);
