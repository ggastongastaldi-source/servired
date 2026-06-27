const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

// 1. Fix SERVI RED → SERVIRED en topbar
html = html.replace(
  '<span class="brand-servi">SERVI</span><span class="brand-red">RED</span>',
  '<span class="brand-servi">SERVI</span><span class="brand-red">RED</span>'
);
// El problema real es el espacio entre los spans - arreglar con CSS
html = html.replace(
  ".topbar-brand{display:flex;align-items:center;gap:8px;font-family:'Rajdhani',sans-serif;font-size:1.15rem;font-weight:700;letter-spacing:.5px;}",
  ".topbar-brand{display:flex;align-items:center;gap:8px;font-family:'Rajdhani',sans-serif;font-size:1.15rem;font-weight:700;letter-spacing:.5px;}.topbar-brand span{letter-spacing:0;}"
);

// 2. Restaurar logo + tagline antes del home-login-block
const logoSVG = `<!-- LOGO HERO -->
<div style="text-align:center;padding:16px 0 20px;">
  <div style="width:90px;height:90px;margin:0 auto 14px;position:relative;">
    <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible;">
      <defs>
        <filter id="glow-s"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="glow-node"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="80" cy="80" r="68" fill="#060c1a" stroke="rgba(0,229,255,0.1)" stroke-width="1"/>
      <g class="arc-orange"><path d="M 80 12 A 68 68 0 1 1 12.1 97" fill="none" stroke="#FF6D00" stroke-width="6" stroke-linecap="round" filter="url(#glow-node)"/></g>
      <g class="arc-cyan"><path d="M 80 22 A 58 58 0 1 0 24.5 107" fill="none" stroke="#00E5FF" stroke-width="4" stroke-linecap="round" filter="url(#glow-node)"/></g>
      <g class="arc-green"><path d="M 80 28 A 52 52 0 0 1 126 54" fill="none" stroke="#39ff14" stroke-width="3" stroke-linecap="round" filter="url(#glow-node)"/></g>
      <line x1="80" y1="80" x2="52" y2="52" class="logo-edge"/>
      <line x1="80" y1="80" x2="108" y2="52" class="logo-edge-orange"/>
      <line x1="80" y1="80" x2="44" y2="88" class="logo-edge"/>
      <line x1="80" y1="80" x2="116" y2="88" class="logo-edge-orange"/>
      <line x1="80" y1="80" x2="58" y2="112" class="logo-edge"/>
      <line x1="80" y1="80" x2="102" y2="112" class="logo-edge-orange"/>
      <circle cx="52" cy="52" r="5" fill="#00E5FF" filter="url(#glow-node)" class="logo-pulse"/>
      <circle cx="44" cy="88" r="4" fill="#00E5FF" filter="url(#glow-node)" class="logo-pulse" style="animation-delay:0.4s"/>
      <circle cx="58" cy="112" r="4.5" fill="#00E5FF" filter="url(#glow-node)" class="logo-pulse" style="animation-delay:0.8s"/>
      <circle cx="108" cy="52" r="5" fill="#FF6D00" filter="url(#glow-node)" class="logo-pulse" style="animation-delay:0.2s"/>
      <circle cx="116" cy="88" r="4" fill="#FF6D00" filter="url(#glow-node)" class="logo-pulse" style="animation-delay:0.6s"/>
      <circle cx="102" cy="112" r="4.5" fill="#FF6D00" filter="url(#glow-node)" class="logo-pulse" style="animation-delay:1s"/>
      <text x="80" y="88" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="42" font-weight="700" fill="#FF6D00" filter="url(#glow-s)">S</text>
    </svg>
  </div>
  <h1 style="font-size:1.8rem;letter-spacing:2px;margin:0 0 6px;">SERVI<span style="color:#FF6D00;">RED</span></h1>
  <p style="color:#e2e8f0;font-size:0.95rem;margin:0 0 4px;font-weight:600;">Sistema operativo de clientes, comercios y trabajadores</p>
  <p style="color:#64748b;font-size:0.75rem;margin:0;">Unidos por inteligencia artificial &middot; AMBA</p>
</div>
`;

const anchor = '<!-- LOGIN HOME - visible solo sin sesion -->';
if (html.indexOf("LOGO HERO") === -1 && html.indexOf(anchor) !== -1) {
  html = html.replace(anchor, logoSVG + anchor);
  console.log("OK logo + tagline restaurado");
} else { console.log("ya existe o anchor no encontrado"); }

fs.writeFileSync("public/index.html", html);
console.log("DONE");
