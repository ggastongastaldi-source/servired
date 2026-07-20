const PRO = (() => {
  let _token = () => localStorage.getItem('sr-token');

  async function _fetch(url) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + _token() } });
    return r.ok ? r.json() : null;
  }

  async function cargarWallet() {
    const d = await _fetch('/api/pagos/wallet');
    if (!d) return;
    const disp = document.getElementById('pro-wallet-disponible');
    const pend = document.getElementById('pro-wallet-pendiente');
    if (disp) disp.textContent = '$ ' + (d.wallet_available ?? 0).toLocaleString('es-AR');
    if (pend) pend.textContent = 'Pendiente: $ ' + (d.wallet_pending ?? 0).toLocaleString('es-AR');
  }

  async function cargarOportunidades() {
    const box = document.getElementById('pro-oportunidades');
    if (!box) return;
    const d = await _fetch('/api/pedidos/disponibles');
    if (!d || !d.pedidos || d.pedidos.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:var(--sp-lg);color:var(--muted);font-size:0.85rem;">Sin oportunidades por ahora. Te avisamos cuando lleguen.</div>';
      return;
    }
    box.innerHTML = d.pedidos.map(p => `
      <div class="card" style="margin-bottom:var(--sp-sm);border-left:3px solid var(--success);">
        <div style="font-weight:700;font-size:0.9rem;">${p.rubro || p.categoria || 'Trabajo'}</div>
        <div style="font-size:0.8rem;color:var(--muted);margin:4px 0;">${p.descripcion || ''}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.78rem;color:var(--muted);">&#128205; ${p.zona || p.direccion || 'AMBA'}</span>
          <span style="font-weight:700;color:var(--success);">$ ${(p.presupuesto_estimado || p.precio || 0).toLocaleString('es-AR')}</span>
        </div>
      </div>`).join('');
  }

  async function cargarTrabajos() {
    const box = document.getElementById('pro-trabajos');
    const tot = document.getElementById('pro-total-trabajos');
    if (!box) return;
    const d = await _fetch('/api/pedidos/mi-pedido-activo');
    if (!d || !d.pedido) {
      if (box) box.innerHTML = '<div style="text-align:center;padding:var(--sp-md);color:var(--muted);font-size:0.85rem;">Sin trabajos activos ahora.</div>';
      if (tot) tot.textContent = '0';
      return;
    }
    if (tot) tot.textContent = '1';
    const recientes = [d.pedido];
    box.innerHTML = recientes.map(t => {
      const estadoColor = t.estado === 'COMPLETADO' ? 'var(--success)' : t.estado === 'EN_CURSO' ? 'var(--accent)' : 'var(--muted)';
      return `
      <div class="card" style="margin-bottom:var(--sp-sm);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:0.85rem;">${t.rubro || t.categoria || 'Trabajo'}</div>
          <span style="font-size:0.72rem;color:${estadoColor};font-weight:700;">${t.estado || ''}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:4px;">&#128205; ${t.zona || t.direccion || 'AMBA'}</div>
      </div>`;
    }).join('');
  }

  async function init() {
    const sub = document.getElementById('pro-subtitle');
    if (sub) {
      const s = OS.sesion();
      sub.textContent = s ? (s.nombre || 'Profesional') + ' · Tu carrera' : 'Tu carrera';
    }
    await Promise.all([cargarWallet(), cargarOportunidades(), cargarTrabajos()]);
  }

  return { init, cargarOportunidades, cargarWallet, cargarTrabajos };
})();
