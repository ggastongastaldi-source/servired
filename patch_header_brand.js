const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

// 1. CSS: topbar brand + welcome card + action cards
const cssOld = ".topbar-status{display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--muted);}";
const cssNew = `.topbar-status{display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--muted);}
.topbar-brand{display:flex;align-items:center;gap:8px;font-family:'Rajdhani',sans-serif;font-size:1.15rem;font-weight:700;letter-spacing:.5px;}
.topbar-brand img{width:32px;height:32px;border-radius:8px;}
.brand-servi{color:#fff;}.brand-red{color:#FF6D00;}
.welcome-card{background:linear-gradient(135deg,rgba(0,229,255,0.08),rgba(255,109,0,0.06));border:1px solid rgba(0,229,255,0.15);border-radius:16px;padding:16px 18px;margin:0 0 18px;display:flex;align-items:center;justify-content:space-between;}
.welcome-card-text h2{font-size:1.25rem;font-weight:700;color:#fff;margin:0 0 2px;}
.welcome-card-text h2 span{color:#00E5FF;}
.welcome-card-text p{font-size:0.8rem;color:#64748b;margin:0;}
.welcome-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#FF6D00,#00E5FF);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:#0a0e1a;overflow:hidden;}
.welcome-avatar img{width:100%;height:100%;object-fit:cover;}
.action-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;}
.action-card{background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 14px;cursor:pointer;transition:transform 0.15s,border-color 0.15s;text-align:left;}
.action-card:hover{transform:translateY(-2px);}
.action-card-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:10px;}
.action-card-title{font-size:0.9rem;font-weight:700;margin-bottom:3px;}
.action-card-desc{font-size:0.72rem;color:#64748b;line-height:1.3;}
.action-card-full{background:var(--surface);border:1px solid rgba(57,255,20,0.2);border-radius:14px;padding:14px 16px;cursor:pointer;transition:transform 0.15s;display:flex;align-items:center;gap:14px;margin-bottom:18px;}
.action-card-full:hover{transform:translateY(-2px);}
.action-card-full .action-card-icon{margin-bottom:0;flex-shrink:0;}
.cats-section{margin-bottom:80px;}
.cats-title{font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;}
.cats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.cat-item{background:var(--surface);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 6px;text-align:center;cursor:pointer;transition:transform 0.15s;}
.cat-item:hover{transform:translateY(-2px);border-color:rgba(0,229,255,0.3);}
.cat-item-icon{font-size:1.4rem;margin-bottom:4px;}
.cat-item-label{font-size:0.65rem;color:#94a3b8;}`;

if (html.indexOf("topbar-brand") === -1) {
  html = html.replace(cssOld, cssNew);
  console.log("OK CSS brand agregado");
} else { console.log("CSS ya existe"); }

// 2. Reemplazar topbar center
const topbarOld = `  <div class="topbar-status"><span class="status-dot"></span> Sistema activo</div>`;
const topbarNew = `  <div class="topbar-brand">
    <img src="/assets/icons/icon-192.png" alt="ServiRed" onerror="this.style.display='none'">
    <span class="brand-servi">SERVI</span><span class="brand-red">RED</span>
  </div>`;

if (html.indexOf("topbar-brand") !== -1 && html.indexOf(topbarOld) !== -1) {
  html = html.replace(topbarOld, topbarNew);
  console.log("OK topbar brand reemplazada");
}

// 3. Reemplazar logo-wrap con nuevo bloque hero completo
const logoOld = `<div class="logo-wrap" style="margin-bottom:20px;padding-top:8px;">`;
const logoNew = `<!-- WELCOME CARD -->
<div class="welcome-card" id="welcome-card" style="display:none;">
  <div class="welcome-card-text">
    <h2>Hola, <span id="welcome-nombre">vos</span> 👋</h2>
    <p>¿Qué querés hacer hoy?</p>
  </div>
  <div class="welcome-avatar" id="welcome-avatar">?</div>
</div>

<!-- ACTION CARDS -->
<div id="action-cards-section">
  <div class="action-cards">
    <div class="action-card" style="border-color:rgba(0,229,255,0.25);" onclick="abrirModalConDestino('cliente')">
      <div class="action-card-icon" style="background:rgba(0,229,255,0.1);">🔍</div>
      <div class="action-card-title" style="color:#00E5FF;">Buscar un servicio</div>
      <div class="action-card-desc">Encontrá profesionales y servicios cerca tuyo</div>
    </div>
    <div class="action-card" style="border-color:rgba(255,109,0,0.25);" onclick="elegirRolDesdeHome('TRABAJADOR')">
      <div class="action-card-icon" style="background:rgba(255,109,0,0.1);">🔧</div>
      <div class="action-card-title" style="color:#FF6D00;">Ofrecer mis servicios</div>
      <div class="action-card-desc">Mostrá tu trabajo y conseguí más clientes</div>
    </div>
  </div>
  <div class="action-card-full" onclick="abrirModal('onboarding-comercio')">
    <div class="action-card-icon" style="background:rgba(57,255,20,0.1);">🏪</div>
    <div>
      <div class="action-card-title" style="color:#39ff14;">Registrar mi comercio</div>
      <div class="action-card-desc">Hacé crecer tu negocio y llegá a más clientes</div>
    </div>
  </div>
</div>

<!-- CATEGORÍAS -->
<div class="cats-section">
  <div class="cats-title">Categorías populares</div>
  <div class="cats-grid">
    <div class="cat-item" onclick="abrirModalConDestino('cliente','electricidad')"><div class="cat-item-icon">⚡</div><div class="cat-item-label">Electricista</div></div>
    <div class="cat-item" onclick="abrirModalConDestino('cliente','plomeria')"><div class="cat-item-icon">🔧</div><div class="cat-item-label">Plomero</div></div>
    <div class="cat-item" onclick="abrirModalConDestino('cliente','albanileria')"><div class="cat-item-icon">🏠</div><div class="cat-item-label">Albañil</div></div>
    <div class="cat-item" onclick="abrirModalConDestino('cliente','pintura')"><div class="cat-item-icon">🎨</div><div class="cat-item-label">Pintor</div></div>
    <div class="cat-item" onclick="irAExplorar()"><div class="cat-item-icon">···</div><div class="cat-item-label">Más</div></div>
  </div>
</div>

<div class="logo-wrap" style="display:none;margin-bottom:20px;padding-top:8px;">`;

if (html.indexOf("welcome-card") === -1) {
  html = html.replace(logoOld, logoNew);
  console.log("OK hero reemplazado con action cards + cats");
} else { console.log("hero ya existe"); }

// 4. Cerrar el div logo-wrap que ahora está hidden (buscar el cierre del SVG grande)
// Agregar función elegirRolDesdeHome y actualizar welcome card desde initAppShell
const fnOld = "document.addEventListener(\"DOMContentLoaded\", initAppShell);";
const fnNew = `document.addEventListener("DOMContentLoaded", initAppShell);

function elegirRolDesdeHome(rol) {
  var token = localStorage.getItem("token");
  if (!token) { abrirModal("modal-login-gen"); return; }
  if (rol === "TRABAJADOR") { iniciarWizardProvider(null); }
}

function actualizarWelcomeCard(snapshot) {
  var card = document.getElementById("welcome-card");
  var nombreEl = document.getElementById("welcome-nombre");
  var avatarEl = document.getElementById("welcome-avatar");
  if (!card) return;
  card.style.display = "flex";
  if (nombreEl && snapshot.nombre) nombreEl.textContent = snapshot.nombre.split(" ")[0];
  if (avatarEl) {
    if (snapshot.avatar) {
      avatarEl.innerHTML = "<img src='" + snapshot.avatar + "' alt='avatar'>";
    } else {
      avatarEl.textContent = (snapshot.nombre || "U")[0].toUpperCase();
    }
  }
}`;

if (html.indexOf("elegirRolDesdeHome") === -1) {
  html = html.replace(fnOld, fnNew);
  console.log("OK funciones welcome agregadas");
}

// 5. Llamar actualizarWelcomeCard desde initAppShell
const shellOld = "    // APP_READY: mostrar UI autenticada\n    mostrarUIAutenticada(data.snapshot);";
const shellNew = "    // APP_READY: mostrar UI autenticada\n    mostrarUIAutenticada(data.snapshot);\n    actualizarWelcomeCard(data.snapshot);";
if (html.indexOf(shellOld) !== -1 && html.indexOf("actualizarWelcomeCard(data.snapshot)") === -1) {
  html = html.replace(shellOld, shellNew);
  console.log("OK welcome card conectada a AppShell");
}

fs.writeFileSync("public/index.html", html);
console.log("DONE index.html actualizado");
