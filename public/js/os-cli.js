const CLI = (() => {
  let _token = () => localStorage.getItem('sr-token');
  async function _fetch(url, opts) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + _token() }, ...opts });
    return r.ok ? r.json() : null;
  }

  async function _cargarRubros() {
    const sel = document.getElementById('cli-rubro');
    if (!sel) return;
    const d = await _fetch('/api/matching/rubros');
    if (!d || !d.rubros) return;
    d.rubros.forEach(r => {
      const o = document.createElement('option');
      o.value = r.slug || r.nombre;
      o.textContent = r.nombre;
      sel.appendChild(o);
    });
  }

  async function solicitar() {
    const rubro = document.getElementById('cli-rubro')?.value;
    const desc = document.getElementById('cli-desc')?.value;
    const res = document.getElementById('cli-resultado');
    if (!rubro) { alert('Seleccioná una categoría'); return; }
    if (res) { res.style.display='block'; res.innerHTML='<div style="text-align:center;color:var(--muted);padding:var(--sp-md);">Buscando profesionales...</div>'; }
    const d = await _fetch('/api/matching/buscar?rubro=' + encodeURIComponent(rubro) + '&descripcion=' + encodeURIComponent(desc||''));
    if (!d || !d.trabajadores || d.trabajadores.length === 0) {
      if (res) res.innerHTML = '<div class="alert alert-info"><span class="alert-icon">&#128269;</span><div>No encontramos profesionales disponibles ahora. Reintentá en unos minutos.</div></div>';
      return;
    }
    if (res) res.innerHTML = '<div style="font-weight:700;margin-bottom:var(--sp-sm);">&#127919; Mejores opciones</div>' +
      d.trabajadores.slice(0,3).map(t => `
        <div class="card" style="margin-bottom:var(--sp-sm);border-left:3px solid var(--accent);">
          <div style="font-weight:700;">${t.nombre || 'Profesional'}</div>
          <div style="font-size:0.78rem;color:var(--muted);margin:4px 0;">&#11088; ${t.rating || '5.0'} &nbsp;&#183;&nbsp; ${t.zona || 'AMBA'}</div>
          <div style="font-size:0.85rem;color:var(--success);font-weight:700;">$ ${(t.presupuesto_estimado || 0).toLocaleString('es-AR')}</div>
        </div>`).join('');
  }

  async function _cargarPedidos() {
    const box = document.getElementById('cli-pedidos');
    if (!box) return;
    const d = await _fetch('/api/pedidos/mis-pedidos');
    if (!d || !d.pedidos || d.pedidos.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:var(--sp-md);color:var(--muted);font-size:0.85rem;">Todavía no hiciste pedidos.</div>';
      return;
    }
    box.innerHTML = d.pedidos.slice(0,5).map(p => {
      const col = p.estado==='COMPLETADO' ? 'var(--success)' : p.estado==='EN_CURSO' ? 'var(--accent)' : 'var(--muted)';
      return `<div class="card" style="margin-bottom:var(--sp-sm);">
        <div style="display:flex;justify-content:space-between;">
          <div style="font-weight:700;font-size:0.85rem;">${p.rubro || p.categoria || 'Pedido'}</div>
          <span style="font-size:0.72rem;color:${col};font-weight:700;">${p.estado||''}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:4px;">&#128205; ${p.zona || p.direccion || 'AMBA'}</div>
      </div>`;
    }).join('');
  }

  async function init() {
    await Promise.all([_cargarRubros(), _cargarPedidos()]);
  }

  return { init, solicitar };
})();
