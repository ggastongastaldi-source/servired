const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

// 1. Bloque login visible en home (solo para no autenticados)
const loginBlock = `<!-- LOGIN HOME - visible solo sin sesion -->
<div id="home-login-block" style="margin-bottom:18px;">
  <div id="home-google-btn" style="display:flex;justify-content:center;margin-bottom:10px;"></div>
  <div style="text-align:center;color:#64748b;font-size:0.72rem;margin-bottom:10px;">— o ingresa con email —</div>
  <button onclick="abrirModal('modal-login-gen')" style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.12);color:#e2e8f0;padding:12px;border-radius:10px;font-family:Rajdhani,sans-serif;font-size:0.95rem;cursor:pointer;">
    Ingresar con email
  </button>
  <div style="text-align:center;margin-top:10px;">
    <span style="color:#64748b;font-size:0.75rem;">No tenes cuenta? </span>
    <span onclick="abrirModal('modal-login-gen')" style="color:#00E5FF;font-size:0.75rem;cursor:pointer;">Registrate gratis</span>
  </div>
</div>
`;

// Insertar antes de action-cards-section
const anchor = '<div id="action-cards-section">';
if (html.indexOf("home-login-block") === -1 && html.indexOf(anchor) !== -1) {
  html = html.replace(anchor, loginBlock + anchor);
  console.log("OK home-login-block insertado");
} else { console.log("ya existe o anchor no encontrado"); }

// 2. CSS para ocultar cuando autenticado
const cssAnchor = ".cats-section{margin-bottom:80px;}";
const cssAdd = `.cats-section{margin-bottom:80px;}
.authenticated #home-login-block{display:none!important;}
.authenticated .welcome-card{display:flex!important;}`;
if (html.indexOf(".authenticated #home-login-block") === -1) {
  html = html.replace(cssAnchor, cssAdd);
  console.log("OK CSS authenticated agregado");
}

fs.writeFileSync("public/index.html", html);
