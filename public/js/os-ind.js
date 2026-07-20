const IND = (() => {
  let _token = () => localStorage.getItem('sr-token');
  async function _fetch(url) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + _token() } });
    return r.ok ? r.json() : null;
  }

  async function _cargarCatalogo() {
    const box = document.getElementById('ind-catalogo');
    const tot = document.getElementById('ind-total-productos');
    if (!box) return;
    // endpoint catalogo pendiente - mostrar CTA
    if (tot) tot.textContent = '0';
    box.innerHTML = '<div class="alert alert-info"><span class="alert-icon">&#127981;</span><div>Public\u00e1 tu producci\u00f3n para conectarte con comercios y clientes de la zona. Funcionalidad disponible pr\u00f3ximamente.</div></div>';
  }

  async function _cargarOportunidades() {
    const box = document.getElementById('ind-oportunidades');
    if (!box) return;
    const d = await _fetch('/api/pedidos/disponibles');
    if (!d || !d.pedidos || d.pedidos.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:var(--sp-md);color:var(--muted);font-size:0.85rem;">Sin demanda activa en tu categoría ahora.</div>';
      return;
    }
    box.innerHTML = d.pedidos.slice(0,4).map(p => `
      <div class="card" style="margin-bottom:var(--sp-sm);border-left:3px solid #ff6d00;">
        <div style="font-weight:700;font-size:0.85rem;">${p.rubro || p.categoria || 'Demanda'}</div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:4px;">&#128205; ${p.zona || 'AMBA'} &nbsp;&#183;&nbsp; ${p.descripcion || ''}</div>
      </div>`).join('');
  }

  function agregarProducto() {
    alert('Funcionalidad de catálogo en desarrollo. Pronto podrás publicar tu producción.');
  }

  async function init() {
    const sub = document.getElementById('ind-subtitle');
    if (sub) { const s = OS.sesion(); sub.textContent = s ? (s.nombre||'Fabricante') + ' · Tu producción' : 'Tu producción en la red'; }
    await Promise.all([_cargarCatalogo(), _cargarOportunidades()]);
  }

  return { init, agregarProducto };
})();
