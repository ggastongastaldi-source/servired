// os-core.js — ServiRed OS Core v2
// Funciones: nav bottom, GIA widget hydration, modal, scroll

// ── BOTTOM NAV ──────────────────────────────────────────────
function bnActivate(id) {
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('bn-' + id);
  if (btn) btn.classList.add('active');
}

function irAExplorar() {
  bnActivate('explorar');
  const v = document.getElementById('view-explorar') ||
            document.getElementById('view-territorial') ||
            document.getElementById('view-comercial');
  if (v) v.scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: 400, behavior: 'smooth' });
}

function handleCTAPrimaria() {
  // Publicar pedido — delega al flujo existente de pedidos
  const modal = document.getElementById('modal-nuevo-pedido') ||
                document.getElementById('modal-pedido') ||
                document.getElementById('modal-soporte');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

// ── MODAL ────────────────────────────────────────────────────
function abrirModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  setTimeout(() => m.classList.add('active'), 10);
}

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('active');
  setTimeout(() => { m.style.display = 'none'; }, 200);
}

// ── GIA WIDGET HYDRATION ─────────────────────────────────────
async function giaHydrate() {
  try {
    // Intentar con token (usuario autenticado)
    const token = localStorage.getItem('token') || localStorage.getItem('sr_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const endpoint = token ? '/api/gia/priority/personal' : '/api/gia/priority';
    const r = await fetch(endpoint, { headers });
    if (!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error('ok=false');

    // Poblar métricas
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val !== null && val !== undefined) ? String(val) : '0';
    };
    set('gia-oportunidades', d.oportunidades);
    set('gia-riesgos',       d.riesgos);
    set('gia-actores-act',   d.actores);
    set('gia-insights-n',    d.insights);

    // Insight narrativo
    const insightEl = document.getElementById('gia-insight-txt');
    if (insightEl && d.topInsight) insightEl.textContent = d.topInsight;

    // Status
    const statusEl = document.getElementById('gia-status-txt');
    if (statusEl) {
      const stateMap = {
        IDLE:           'Sistema operativo',
        ALERT:          '⚠ Alerta activa',
        RECOMMENDATION: '💡 Recomendación disponible'
      };
      statusEl.textContent = stateMap[d.state] || 'Inteligencia territorial activa';
    }

    // Drawer insight si existe
    const drawerInsight = document.getElementById('gia-drawer-insight-txt');
    if (drawerInsight && d.topInsight) drawerInsight.textContent = d.topInsight;

    // Acción GIA
    if (d.action) {
      const actionBtn = document.querySelector('.gia-action');
      if (actionBtn && d.action.label) {
        // Solo sobreescribir si no es el botón de chat
        // Mantenemos "Hablar con GIA" como CTA principal
      }
    }

  } catch(e) {
    console.warn('[GIA] hydrate error:', e.message);
    const insightEl = document.getElementById('gia-insight-txt');
    if (insightEl) insightEl.textContent = 'Sistema operativo. Inteligencia territorial activa.';
    ['gia-oportunidades','gia-riesgos','gia-actores-act','gia-insights-n'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
  }
}

// ── BOTTOM NAV RENDER ────────────────────────────────────────
function renderBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  nav.innerHTML = `
    <button class="bn-item active" id="bn-inicio"
      onclick="bnActivate('inicio');window.scrollTo({top:0,behavior:'smooth'})"
      aria-label="Inicio">
      <span class="nav-icon">🏠</span>
      <span class="bn-label">Inicio</span>
    </button>
    <button class="bn-item" id="bn-explorar"
      onclick="irAExplorar()"
      aria-label="Explorar">
      <span class="nav-icon">🔍</span>
      <span class="bn-label">Explorar</span>
    </button>
    <button class="bn-item bn-publish" id="bn-publicar"
      onclick="bnActivate('publicar');handleCTAPrimaria()"
      aria-label="Publicar">
      <span class="nav-icon">＋</span>
      <span class="bn-label">Publicar</span>
    </button>
  `;
  nav.style.display = 'flex';
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderBottomNav();
  giaHydrate();
  // Re-hydrate cada 60s
  setInterval(giaHydrate, 60000);
});
