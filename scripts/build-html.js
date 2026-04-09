const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SERVired <!-- BUILD:${Date.now()} --></title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
:root{--cyan:#00E5FF;--orange:#FF6D00;--bg:#0a0e1a;--surface:#111827;--surface2:#1a2236;--text:#e2e8f0;--muted:#64748b;--success:#10b981;--danger:#ef4444;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}

/* ── LOGO NEURONAL ── */
.logo-wrap{text-align:center;margin-bottom:36px;}
.neural-logo{width:130px;height:130px;margin:0 auto 18px;position:relative;}
.neural-logo svg{width:100%;height:100%;}
.logo-node{fill:#00E5FF;filter:drop-shadow(0 0 6px #00E5FF);}
.logo-node-orange{fill:#FF6D00;filter:drop-shadow(0 0 6px #FF6D00);}
.logo-edge{stroke:rgba(0,229,255,0.35);stroke-width:1.2;stroke-dasharray:4 3;animation:dash 3s linear infinite;}
.logo-edge-orange{stroke:rgba(255,109,0,0.35);stroke-width:1.2;stroke-dasharray:4 3;animation:dash 3s linear infinite reverse;}
.logo-ring-outer{fill:none;stroke:rgba(0,229,255,0.2);stroke-width:1;animation:spin 12s linear infinite;}
.logo-ring-inner{fill:none;stroke:rgba(255,109,0,0.2);stroke-width:1;animation:spin 8s linear infinite reverse;}
.logo-center-glow{fill:radial-gradient(circle,#1a2a4a,#0a0e1a);}
@keyframes dash{to{stroke-dashoffset:-20;}}
@keyframes spin{to{transform:rotate(360deg);transform-origin:65px 65px;}}
@keyframes pulse{0%,100%{opacity:0.6;}50%{opacity:1;}}
.logo-pulse{animation:pulse 2s ease-in-out infinite;}

h1{font-size:2.5rem;font-weight:700;letter-spacing:4px;margin-bottom:4px;}
h1 span{color:var(--orange);}
.sub{color:var(--muted);font-size:0.88rem;margin-bottom:3px;}
.domain{color:var(--cyan);font-size:0.92rem;font-family:'Share Tech Mono',monospace;}

/* ── TRIÁNGULO DE ROLES ── */
.triangle-wrap{display:flex;flex-direction:column;align-items:center;margin-bottom:28px;width:100%;max-width:380px;}
.triangle-label{font-size:0.72rem;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;}
.triangle-svg-wrap{position:relative;width:280px;height:160px;margin:0 auto;}
.triangle-svg-wrap svg{width:100%;height:100%;}
.tri-edge{stroke:rgba(0,229,255,0.18);stroke-width:1;stroke-dasharray:6 4;}
.tri-node{cursor:pointer;transition:filter 0.2s;}
.tri-node:hover .tri-circle{filter:drop-shadow(0 0 10px currentColor);}
.tri-label{font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;fill:var(--muted);text-anchor:middle;}
.tri-icon{font-size:18px;text-anchor:middle;dominant-baseline:middle;}

/* ── BOTONES ── */
.btns{display:flex;flex-direction:column;gap:11px;width:100%;max-width:380px;}
.btn{width:100%;padding:15px 20px;border-radius:14px;font-family:'Rajdhani',sans-serif;font-size:1.05rem;font-weight:700;cursor:pointer;transition:all 0.2s;border:none;display:flex;align-items:center;justify-content:center;gap:10px;}
.btn-cyan{background:var(--cyan);color:#0a0e1a;}
.btn-cyan:hover{background:#00cfeb;transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,229,255,0.35);}
.btn-orange{background:var(--orange);color:#fff;}
.btn-orange:hover{background:#e66300;transform:translateY(-2px);box-shadow:0 6px 24px rgba(255,109,0,0.35);}
.btn-outline{background:transparent;color:var(--cyan);border:2px solid var(--cyan);}
.btn-outline:hover{background:rgba(0,229,255,0.08);transform:translateY(-2px);}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid rgba(255,255,255,0.1);}
.btn-ghost:hover{border-color:var(--cyan);color:var(--cyan);}
.btn-admin{background:transparent;color:var(--muted);border:none;font-size:0.82rem;padding:8px;margin-top:2px;}

/* ── MODALS ── */
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;align-items:flex-end;justify-content:center;}
.modal-bg.show{display:flex;}
.modal{background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px;width:100%;max-width:480px;border-top:2px solid var(--cyan);}
.modal-title{font-size:1.2rem;font-weight:700;margin-bottom:16px;color:var(--cyan);}
.field{margin-bottom:12px;}
.field label{display:block;font-size:0.78rem;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;}
.field input{width:100%;padding:12px 14px;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:1rem;outline:none;}
.field input:focus{border-color:var(--cyan);}
.field input::placeholder{color:var(--muted);}
.modal-btns{display:flex;gap:10px;margin-top:16px;}
.btn-sm{flex:1;padding:12px;border-radius:10px;font-family:'Rajdhani',sans-serif;font-size:1rem;font-weight:700;cursor:pointer;border:none;}
.btn-sm-pri{background:var(--cyan);color:#0a0e1a;}
.btn-sm-sec{background:var(--surface2);color:var(--muted);border:1px solid rgba(255,255,255,0.1);}
.err{color:var(--danger);font-size:0.82rem;margin-top:8px;display:none;}
.err.show{display:block;}
</style>
</head>
<body>

<!-- LOGO NEURONAL SVG -->
<div class="logo-wrap">
  <div class="neural-logo">
    <svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
      <!-- anillos externos -->
      <circle cx="65" cy="65" r="60" class="logo-ring-outer"/>
      <circle cx="65" cy="65" r="48" class="logo-ring-inner"/>
      <!-- fondo círculo central -->
      <circle cx="65" cy="65" r="38" fill="#0d1528" stroke="rgba(0,229,255,0.15)" stroke-width="1"/>
      <!-- edges neuronales -->
      <line x1="65" y1="65" x2="30" y2="30" class="logo-edge"/>
      <line x1="65" y1="65" x2="100" y2="30" class="logo-edge-orange"/>
      <line x1="65" y1="65" x2="20" y2="72" class="logo-edge"/>
      <line x1="65" y1="65" x2="110" y2="72" class="logo-edge-orange"/>
      <line x1="65" y1="65" x2="40" y2="105" class="logo-edge"/>
      <line x1="65" y1="65" x2="90" y2="105" class="logo-edge-orange"/>
      <line x1="30" y1="30" x2="100" y2="30" class="logo-edge"/>
      <line x1="20" y1="72" x2="40" y2="105" class="logo-edge"/>
      <line x1="110" y1="72" x2="90" y2="105" class="logo-edge-orange"/>
      <!-- nodos periféricos cyan -->
      <circle cx="30" cy="30" r="5" class="logo-node logo-pulse"/>
      <circle cx="20" cy="72" r="4" class="logo-node logo-pulse" style="animation-delay:0.4s"/>
      <circle cx="40" cy="105" r="4.5" class="logo-node logo-pulse" style="animation-delay:0.8s"/>
      <!-- nodos periféricos orange -->
      <circle cx="100" cy="30" r="5" class="logo-node-orange logo-pulse" style="animation-delay:0.2s"/>
      <circle cx="110" cy="72" r="4" class="logo-node-orange logo-pulse" style="animation-delay:0.6s"/>
      <circle cx="90" cy="105" r="4.5" class="logo-node-orange logo-pulse" style="animation-delay:1s"/>
      <!-- letra S central -->
      <text x="65" y="72" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="32" font-weight="700" fill="#FF6D00" filter="url(#glow)">S</text>
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
    </svg>
  </div>
  <h1>SERVI<span>RED</span></h1>
  <p class="sub">Conectando servicios reales · Trabajadores verificados · IA</p>
  <p class="domain">servired.online</p>
</div>

<!-- TRIÁNGULO DE ROLES -->
<div class="triangle-wrap">
  <div class="triangle-label">Ecosistema de roles</div>
  <div class="triangle-svg-wrap">
    <svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
      <!-- bordes del triángulo -->
      <line x1="140" y1="18" x2="30" y2="148" class="tri-edge"/>
      <line x1="140" y1="18" x2="250" y2="148" class="tri-edge"/>
      <line x1="30" y1="148" x2="250" y2="148" class="tri-edge"/>
      <!-- líneas internas al centro -->
      <line x1="140" y1="18" x2="140" y2="105" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <line x1="30" y1="148" x2="140" y2="105" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <line x1="250" y1="148" x2="140" y2="105" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <!-- nodo centro -->
      <circle cx="140" cy="105" r="5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <!-- ADMIN - arriba (cian) -->
      <g class="tri-node" onclick="abrirModal('admin-login')" style="color:#00E5FF;">
        <circle cx="140" cy="18" r="22" fill="#0d1528" stroke="#00E5FF" stroke-width="1.5" style="filter:drop-shadow(0 0 8px rgba(0,229,255,0.4));"/>
        <text x="140" y="16" class="tri-icon">⚙️</text>
        <text x="140" y="46" class="tri-label" fill="#00E5FF">ADMIN</text>
      </g>
      <!-- TRABAJADOR - abajo izquierda (orange) -->
      <g class="tri-node" onclick="abrirModal('worker-login')" style="color:#FF6D00;">
        <circle cx="30" cy="148" r="22" fill="#0d1528" stroke="#FF6D00" stroke-width="1.5" style="filter:drop-shadow(0 0 8px rgba(255,109,0,0.4));"/>
        <text x="30" y="146" class="tri-icon">🔧</text>
        <text x="30" y="126" class="tri-label" fill="#FF6D00">TRABAJADOR</text>
      </g>
      <!-- CLIENTE - abajo derecha (verde) -->
      <g class="tri-node" onclick="abrirModal('cliente-login')" style="color:#10b981;">
        <circle cx="250" cy="148" r="22" fill="#0d1528" stroke="#10b981" stroke-width="1.5" style="filter:drop-shadow(0 0 8px rgba(16,185,129,0.4));"/>
        <text x="250" y="146" class="tri-icon">🔍</text>
        <text x="250" y="126" class="tri-label" fill="#10b981">CLIENTE</text>
      </g>
    </svg>
  </div>
  <p style="font-size:0.72rem;color:var(--muted);margin-top:6px;">Tocá tu rol para ingresar</p>
</div>

<!-- BOTONES -->
<div class="btns">
  <button class="btn btn-cyan" onclick="abrirModal('cliente-login')">🔍 Busco un Servicio (Cliente)</button>
  <button class="btn btn-orange" onclick="abrirModal('worker-login')">🔧 Ofrezco mis Servicios (Trabajador)</button>
  <button class="btn btn-outline" onclick="abrirModal('registro-cliente')">📝 Registrarme como Cliente</button>
  <button class="btn btn-ghost" onclick="abrirModal('login-gen')">🔑 Ya tengo cuenta</button>
  <button class="btn-admin" onclick="abrirModal('admin-login')">⚙️ Admin</button>
</div>

<!-- MODAL LOGIN CLIENTE -->
<div class="modal-bg" id="modal-cliente-login">
  <div class="modal">
    <div class="modal-title">🔍 Ingresar como Cliente</div>
    <div class="field"><label>Email</label><input type="email" id="cl-email" placeholder="tu@email.com"></div>
    <div class="field"><label>Contraseña</label><input type="password" id="cl-pass" placeholder="••••••••"></div>
    <div class="err" id="cl-err">Email o contraseña incorrectos</div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-sec" onclick="cerrarModals()">Cancelar</button>
      <button class="btn-sm btn-sm-pri" onclick="login('CLIENTE','cl-email','cl-pass','cl-err')">Ingresar →</button>
    </div>
  </div>
</div>

<!-- MODAL LOGIN TRABAJADOR -->
<div class="modal-bg" id="modal-worker-login">
  <div class="modal">
    <div class="modal-title">🔧 Ingresar como Trabajador</div>
    <div class="field"><label>Email</label><input type="email" id="wl-email" placeholder="tu@email.com"></div>
    <div class="field"><label>Contraseña</label><input type="password" id="wl-pass" placeholder="••••••••"></div>
    <div class="err" id="wl-err">Email o contraseña incorrectos</div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-sec" onclick="cerrarModals()">Cancelar</button>
      <button class="btn-sm btn-sm-pri" onclick="login('TRABAJADOR','wl-email','wl-pass','wl-err')">Ingresar →</button>
    </div>
  </div>
</div>

<!-- MODAL LOGIN GENERAL -->
<div class="modal-bg" id="modal-login-gen">
  <div class="modal">
    <div class="modal-title">🔑 Ya tengo cuenta</div>
    <div class="field"><label>Email</label><input type="email" id="gl-email" placeholder="tu@email.com"></div>
    <div class="field"><label>Contraseña</label><input type="password" id="gl-pass" placeholder="••••••••"></div>
    <div class="err" id="gl-err">Email o contraseña incorrectos</div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-sec" onclick="cerrarModals()">Cancelar</button>
      <button class="btn-sm btn-sm-pri" onclick="login(null,'gl-email','gl-pass','gl-err')">Ingresar →</button>
    </div>
  </div>
</div>

<!-- MODAL REGISTRO CLIENTE -->
<div class="modal-bg" id="modal-registro-cliente">
  <div class="modal">
    <div class="modal-title">📝 Registrarme como Cliente</div>
    <div class="field"><label>Nombre completo</label><input type="text" id="rc-nombre" placeholder="Juan García"></div>
    <div class="field"><label>Email</label><input type="email" id="rc-email" placeholder="tu@email.com"></div>
    <div class="field"><label>Contraseña</label><input type="password" id="rc-pass" placeholder="Mínimo 6 caracteres"></div>
    <div class="err" id="rc-err">Error al registrar</div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-sec" onclick="cerrarModals()">Cancelar</button>
      <button class="btn-sm btn-sm-pri" onclick="registrar('CLIENTE')">Registrarme →</button>
    </div>
  </div>
</div>

<!-- MODAL LOGIN ADMIN -->
<div class="modal-bg" id="modal-admin-login">
  <div class="modal">
    <div class="modal-title">⚙️ Acceso Admin</div>
    <div class="field"><label>Email</label><input type="email" id="al-email" placeholder="admin@servired.com"></div>
    <div class="field"><label>Contraseña</label><input type="password" id="al-pass" placeholder="••••••••"></div>
    <div class="err" id="al-err">Acceso denegado</div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-sec" onclick="cerrarModals()">Cancelar</button>
      <button class="btn-sm btn-sm-pri" onclick="login('ADMIN','al-email','al-pass','al-err')">Entrar →</button>
    </div>
  </div>
</div>

<script>
function abrirModal(id){cerrarModals();document.getElementById('modal-'+id).classList.add('show');}
function cerrarModals(){document.querySelectorAll('.modal-bg').forEach(m=>m.classList.remove('show'));}
document.querySelectorAll('.modal-bg').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)cerrarModals();}));

async function login(rolEsperado,emailId,passId,errId){
  const email=document.getElementById(emailId).value.trim();
  const pass=document.getElementById(passId).value;
  const errEl=document.getElementById(errId);
  errEl.classList.remove('show');
  if(!email||!pass){errEl.textContent='Completá todos los campos';errEl.classList.add('show');return;}
  try{
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const data=await r.json();
    if(!r.ok){errEl.textContent=data.mensaje||data.error||'Error al ingresar';errEl.classList.add('show');return;}
    const token=data.token||data.data?.token;
    if(!token){errEl.textContent='Error: sin token';errEl.classList.add('show');return;}
    localStorage.setItem('token',token);
    const payload=JSON.parse(atob(token.split('.')[1]));
    const rol=payload.rol||payload.role;
    if(rol==='ADMIN')window.location='/admin.html';
    else if(rol==='TRABAJADOR')window.location='/trabajador.html';
    else window.location='/cliente.html';
  }catch(e){errEl.textContent='Error de conexión';errEl.classList.add('show');}
}

async function registrar(rol){
  const nombre=document.getElementById('rc-nombre').value.trim();
  const email=document.getElementById('rc-email').value.trim();
  const pass=document.getElementById('rc-pass').value;
  const errEl=document.getElementById('rc-err');
  errEl.classList.remove('show');
  if(!nombre||!email||!pass){errEl.textContent='Completá todos los campos';errEl.classList.add('show');return;}
  if(pass.length<6){errEl.textContent='Contraseña mínimo 6 caracteres';errEl.classList.add('show');return;}
  try{
    const r=await fetch('/api/auth/registro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre,email,password:pass,rol})});
    const data=await r.json();
    if(!r.ok){errEl.textContent=data.mensaje||data.error||'Error al registrar';errEl.classList.add('show');return;}
    const token=data.token||data.data?.token;
    if(token){localStorage.setItem('token',token);window.location='/cliente.html';}
    else{errEl.textContent='Registrado. Ahora ingresá.';errEl.classList.add('show');}
  }catch(e){errEl.textContent='Error de conexión';errEl.classList.add('show');}
}

const t=localStorage.getItem('token');
if(t){try{const p=JSON.parse(atob(t.split('.')[1]));if(p.exp>Date.now()/1000){const rol=p.rol||p.role;if(rol==='ADMIN')window.location='/admin.html';else if(rol==='TRABAJADOR')window.location='/trabajador.html';else window.location='/cliente.html';}}catch(e){localStorage.removeItem('token');}}
</script>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'public', 'index.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('✅ index.html generado con logo neuronal + triángulo de roles · build:', Date.now());
