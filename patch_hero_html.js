const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

const heroHTML = `<!-- WELCOME CARD -->
<div class="welcome-card" id="welcome-card" style="display:none;">
  <div class="welcome-card-text"><h2>Hola, <span id="welcome-nombre">vos</span> </h2><p>Que queres hacer hoy?</p></div>
  <div class="welcome-avatar" id="welcome-avatar">?</div>
</div>
<!-- ACTION CARDS -->
<div id="action-cards-section">
  <div class="action-cards">
    <div class="action-card" style="border-color:rgba(0,229,255,0.25);" onclick="abrirModalConDestino('cliente')">
      <div class="action-card-icon" style="background:rgba(0,229,255,0.1);">&#128269;</div>
      <div class="action-card-title" style="color:#00E5FF;">Buscar un servicio</div>
      <div class="action-card-desc">Encontra profesionales cerca tuyo</div>
    </div>
    <div class="action-card" style="border-color:rgba(255,109,0,0.25);" onclick="elegirRolDesdeHome('TRABAJADOR')">
      <div class="action-card-icon" style="background:rgba(255,109,0,0.1);">&#128295;</div>
      <div class="action-card-title" style="color:#FF6D00;">Ofrecer mis servicios</div>
      <div class="action-card-desc">Mostra tu trabajo y consegi clientes</div>
    </div>
  </div>
  <div class="action-card-full" onclick="abrirModal('onboarding-comercio')">
    <div class="action-card-icon" style="background:rgba(57,255,20,0.1);">&#127978;</div>
    <div><div class="action-card-title" style="color:#39ff14;">Registrar mi comercio</div><div class="action-card-desc">Hace crecer tu negocio y llega a mas clientes</div></div>
  </div>
</div>
<!-- CATEGORIAS -->
<div class="cats-section">
  <div class="cats-title">Categorias populares</div>
  <div class="cats-grid">
    <div class="cat-item" onclick="abrirModalConDestino('cliente','electricidad')"><div class="cat-item-icon">&#9889;</div><div class="cat-item-label">Electricista</div></div>
    <div class="cat-item" onclick="abrirModalConDestino('cliente','plomeria')"><div class="cat-item-icon">&#128295;</div><div class="cat-item-label">Plomero</div></div>
    <div class="cat-item" onclick="abrirModalConDestino('cliente','albanileria')"><div class="cat-item-icon">&#127968;</div><div class="cat-item-label">Albanil</div></div>
    <div class="cat-item" onclick="abrirModalConDestino('cliente','pintura')"><div class="cat-item-icon">&#127912;</div><div class="cat-item-label">Pintor</div></div>
    <div class="cat-item" onclick="irAExplorar()"><div class="cat-item-icon">...</div><div class="cat-item-label">Mas</div></div>
  </div>
</div>
`;

const anchor = '<div class="logo-wrap"';
const idx = html.indexOf(anchor);
if (idx !== -1 && html.indexOf('welcome-card" id') === -1) {
  html = html.slice(0, idx) + heroHTML + html.slice(idx);
  fs.writeFileSync("public/index.html", html);
  console.log("OK hero insertado");
} else if (html.indexOf('welcome-card" id') !== -1) {
  console.log("ya existe");
} else {
  console.log("ERROR: anchor no encontrado");
}
