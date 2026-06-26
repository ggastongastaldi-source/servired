// ── MERCHANT APP v2.0 ────────────────────────────────────────────────────────
// ServiRed — Panel de Comercios | Conectado a Projection Engine
'use strict';

const MerchantApp = (() => {

  // ── Estado ─────────────────────────────────────────────────────────────────
  const S = {
    token:          null,
    perfil:         null,
    dashboardState: null,
    catalogItems:   [],
    editingItemId:  null,
    seccion:        'dashboard'
  };

  // ── Auth ───────────────────────────────────────────────────────────────────
  const getToken = () =>
    localStorage.getItem('merchant_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token');

  // ── API ────────────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const r = await fetch(`/api/merchant${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      ...(body != null ? { body: JSON.stringify(body) } : {})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  // ── Navegación ─────────────────────────────────────────────────────────────
  function irSeccion(sec) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const secEl = document.getElementById(`sec-${sec}`);
    const navEl = document.querySelector(`.nav-item[data-section="${sec}"]`);
    if (secEl) secEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    S.seccion = sec;
    if (sec === 'catalogo')  cargarCatalogo();
    if (sec === 'analitica') cargarAnalytics();
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  async function cargarDashboard() {
    try {
      const data = await api('GET', '/dashboard');
      S.dashboardState = data;
      renderDashboard(data);
    } catch (e) {
      console.warn('[merchant] dashboard:', e.message);
      renderDashboardVacio();
    }
  }

  function renderDashboard(d) {
    setKPI('kpiVistas',      d.actividad?.vistasHoy ?? '—',              'Hoy');
    setKPI('kpiSolicitudes', d.actividad?.solicitudesHoy ?? '—',         'Hoy');
    setKPI('kpiPedidos',     d.actividad?.pedidosConcretados ?? '—',     'Total');
    setKPI('kpiCalificacion',
      d.actividad?.calificacion ? d.actividad.calificacion.toFixed(1) + ' ★' : '—', 'Promedio');
    setKPI('kpiIngresos',
      d.ingresos?.estimadoMes ? fmtARS(d.ingresos.estimadoMes) : '—',   'Este mes');
    setKPI('kpiCampanias',   d.campanias?.activas ?? '—',                'Activas');

    renderEstado({ estado: d.estado, nombreComercial: d.nombreComercial, logo: d.logo });

    const fechaEl = q('dashFecha');
    if (fechaEl) fechaEl.textContent = new Date().toLocaleDateString('es-AR',
      { weekday:'long', day:'numeric', month:'long' });

    const nameEl = q('merchantName');
    if (nameEl && d.nombreComercial) {
      nameEl.textContent = d.nombreComercial;
      q('avatarInitial').textContent = d.nombreComercial[0].toUpperCase();
    }

    // Tendencia mini-chart (sparkline ASCII simple)
    if (d.tendencia?.vistasUltimos7dias) renderSparkline('sparklineVistas', d.tendencia.vistasUltimos7dias);
  }

  function renderDashboardVacio() {
    ['kpiVistas','kpiSolicitudes','kpiPedidos','kpiCalificacion','kpiIngresos','kpiCampanias']
      .forEach(id => setKPI(id, '—', '—'));
    renderEstado(null);
  }

  function setKPI(id, value, delta) {
    const card = document.getElementById(id);
    if (!card) return;
    card.querySelector('.kpi-value').textContent = value;
    card.querySelector('.kpi-delta').textContent = delta;
  }

  function renderEstado(perfil) {
    const badge = q('statusBadge'), msg = q('statusMsg'), cta = q('statusCTA');
    if (!badge) return;
    const map = {
      ACTIVE:               { cls:'active',    label:'Activo',      txt:'Tu negocio está activo y visible en ServiRed.' },
      PENDING_VERIFICATION: { cls:'draft',     label:'En revisión', txt:'Tu perfil está siendo verificado.' },
      DRAFT:                { cls:'draft',     label:'Incompleto',  txt:'Completá tu perfil para recibir solicitudes.' },
      SUSPENDED:            { cls:'suspended', label:'Suspendido',  txt:'Contactá soporte.' }
    };
    const e = map[perfil?.estado] || { cls:'', label:'Sin perfil', txt:'Configurá el perfil de tu negocio.' };
    badge.className = `status-badge ${e.cls}`;
    badge.textContent = e.label;
    msg.textContent = e.txt;
    if (cta) cta.style.display = (!perfil || perfil.estado === 'DRAFT') ? 'inline-block' : 'none';
  }

  function renderSparkline(elId, serie) {
    const el = document.getElementById(elId);
    if (!el) return;
    const max = Math.max(...serie.map(d => d.cantidad), 1);
    el.innerHTML = serie.map(d => {
      const h = Math.round((d.cantidad / max) * 32);
      return `<span class="spark-bar" style="height:${h}px" title="${d.fecha}: ${d.cantidad}"></span>`;
    }).join('');
  }

  // ── PERFIL ─────────────────────────────────────────────────────────────────
  async function cargarPerfil() {
    try {
      const { exists, profile } = await api('GET', '/profile');
      if (exists && profile) { S.perfil = profile; poblarFormPerfil(profile); }
    } catch (e) { console.warn('[merchant] cargarPerfil:', e.message); }
  }

  function poblarFormPerfil(p) {
    const m = {
      fNombreComercial: p.nombreComercial,
      fRazonSocial:     p.razonSocial,
      fCuit:            p.cuit,
      fRubroId:         p.rubroId,
      fDireccion:       p.locales?.[0]?.direccion,
      fZonaId:          p.zonaId,
      fWhatsapp:        p.whatsapp,
      fEmail:           p.email,
      fWebsite:         p.website,
      fInstagram:       p.instagram
    };
    Object.entries(m).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    });
  }

  async function guardarPerfil() {
    const st = q('saveStatus');
    if (st) st.textContent = 'Guardando...';
    const body = {
      nombreComercial: gv('fNombreComercial'),
      razonSocial:     gv('fRazonSocial'),
      cuit:            gv('fCuit'),
      rubroId:         gv('fRubroId'),
      zonaId:          gv('fZonaId'),
      whatsapp:        gv('fWhatsapp'),
      email:           gv('fEmail'),
      website:         gv('fWebsite'),
      instagram:       gv('fInstagram'),
      locales: [{ direccion: gv('fDireccion'), telefono: gv('fWhatsapp') }]
    };
    if (!body.nombreComercial) { toast('El nombre comercial es obligatorio', 'error'); if(st) st.textContent=''; return; }
    try {
      const data = await api(S.perfil ? 'PATCH' : 'POST', '/profile', body);
      S.perfil = data.profile;
      toast('Perfil guardado', 'success');
      if (st) { st.textContent = 'Guardado ✓'; setTimeout(() => { st.textContent=''; }, 3000); }
    } catch (e) {
      toast(`Error: ${e.message}`, 'error');
      if (st) st.textContent = '';
    }
  }

  // ── CATÁLOGO ───────────────────────────────────────────────────────────────
  async function cargarCatalogo() {
    try {
      const { items } = await api('GET', '/catalog?estado=TODOS&limit=50');
      S.catalogItems = items;
      renderCatalogo(items);
    } catch (e) {
      console.warn('[merchant] catalogo:', e.message);
      renderCatalogoVacio();
    }
  }

  function renderCatalogo(items) {
    const grid = q('catalogGrid');
    if (!grid) return;
    if (!items.length) { renderCatalogoVacio(); return; }

    grid.innerHTML = items.map(item => `
      <div class="catalog-item-card estado-${item.estado.toLowerCase()}" data-id="${item._id}">
        <div class="cic-img">
          ${item.imagenPrincipal
            ? `<img src="${item.imagenPrincipal}" alt="${item.nombre}">`
            : `<div class="cic-img-placeholder">◧</div>`}
          ${item.enPromocion ? '<span class="cic-promo-badge">PROMO</span>' : ''}
        </div>
        <div class="cic-body">
          <div class="cic-nombre">${item.nombre}</div>
          <div class="cic-precio">${fmtARS(item.precioARS)}</div>
          ${item.stock !== null ? `<div class="cic-stock">Stock: ${item.stock}</div>` : ''}
          <div class="cic-estado cic-estado-${item.estado.toLowerCase()}">${item.estado}</div>
        </div>
        <div class="cic-actions">
          <button class="cic-btn" onclick="editarItem('${item._id}')">Editar</button>
          <button class="cic-btn danger" onclick="eliminarItem('${item._id}')">Quitar</button>
        </div>
      </div>
    `).join('');
  }

  function renderCatalogoVacio() {
    const grid = q('catalogGrid');
    if (grid) grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◧</div>
        <p>Todavía no tenés productos cargados.</p>
        <button class="btn-primary" onclick="abrirNuevoProducto()">Cargar primer producto</button>
      </div>`;
  }

  function abrirNuevoProducto() {
    S.editingItemId = null;
    abrirModalProducto({});
  }

  function editarItem(id) {
    const item = S.catalogItems.find(i => i._id === id);
    if (!item) return;
    S.editingItemId = id;
    abrirModalProducto(item);
  }

  async function eliminarItem(id) {
    if (!confirm('¿Quitás este producto del catálogo?')) return;
    try {
      await api('DELETE', `/catalog/${id}`);
      toast('Producto quitado', 'success');
      cargarCatalogo();
    } catch (e) { toast(`Error: ${e.message}`, 'error'); }
  }

  function abrirModalProducto(item) {
    // Modal inline
    const existing = document.getElementById('modalProducto');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modalProducto';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <span>${S.editingItemId ? 'Editar producto' : 'Nuevo producto'}</span>
          <button class="modal-close" onclick="cerrarModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-field wide">
              <label>Nombre *</label>
              <input id="mpNombre" type="text" value="${item.nombre || ''}" placeholder="Ej: Tornillo 6x1 (100u)">
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Precio ARS *</label>
              <input id="mpPrecio" type="number" value="${item.precioARS || ''}" min="0" step="1" placeholder="0">
            </div>
            <div class="form-field">
              <label>Stock</label>
              <input id="mpStock" type="number" value="${item.stock ?? ''}" min="0" placeholder="Sin control">
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Rubro</label>
              <input id="mpRubro" type="text" value="${item.rubroId || (S.perfil?.rubroId || '')}" placeholder="ferreteria">
            </div>
            <div class="form-field">
              <label>Estado</label>
              <select id="mpEstado">
                <option value="ACTIVO"   ${item.estado==='ACTIVO'   ?'selected':''}>Activo</option>
                <option value="PAUSADO"  ${item.estado==='PAUSADO'  ?'selected':''}>Pausado</option>
                <option value="BORRADOR" ${item.estado==='BORRADOR' ?'selected':''}>Borrador</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field wide">
              <label>Descripción</label>
              <input id="mpDesc" type="text" value="${item.descripcion || ''}" placeholder="Descripción breve">
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>En promoción</label>
              <select id="mpPromo">
                <option value="false" ${!item.enPromocion?'selected':''}>No</option>
                <option value="true"  ${item.enPromocion?'selected':''}>Sí</option>
              </select>
            </div>
            <div class="form-field">
              <label>Precio promo ARS</label>
              <input id="mpPrecioPromo" type="number" value="${item.precioPromo || ''}" min="0" placeholder="—">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="guardarProducto()">Guardar</button>
          <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function guardarProducto() {
    const nombre = document.getElementById('mpNombre')?.value?.trim();
    const precio = parseFloat(document.getElementById('mpPrecio')?.value);
    if (!nombre || isNaN(precio)) { toast('Nombre y precio son obligatorios', 'error'); return; }

    const stockVal = document.getElementById('mpStock')?.value;
    const body = {
      nombre,
      precioARS:    precio,
      stock:        stockVal !== '' ? parseInt(stockVal) : null,
      rubroId:      document.getElementById('mpRubro')?.value?.trim() || 'general',
      estado:       document.getElementById('mpEstado')?.value,
      descripcion:  document.getElementById('mpDesc')?.value?.trim(),
      enPromocion:  document.getElementById('mpPromo')?.value === 'true',
      precioPromo:  parseFloat(document.getElementById('mpPrecioPromo')?.value) || null
    };

    try {
      if (S.editingItemId) {
        await api('PATCH', `/catalog/${S.editingItemId}`, body);
        toast('Producto actualizado', 'success');
      } else {
        await api('POST', '/catalog', body);
        toast('Producto agregado', 'success');
      }
      cerrarModal();
      cargarCatalogo();
    } catch (e) { toast(`Error: ${e.message}`, 'error'); }
  }

  function cerrarModal() {
    const m = document.getElementById('modalProducto');
    if (m) m.remove();
    S.editingItemId = null;
  }

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  async function cargarAnalytics() {
    try {
      const data = await api('GET', '/analytics');
      renderAnalytics(data);
    } catch (e) { console.warn('[merchant] analytics:', e.message); }
  }

  function renderAnalytics(data) {
    // Top productos
    const topEl = q('topProductos');
    if (topEl) {
      topEl.innerHTML = data.topProductos?.length
        ? data.topProductos.map((p, i) =>
            `<div class="rank-row"><span class="rank-num">${i+1}</span><span class="rank-name">${p.nombre}</span><span class="rank-val">${p.vistas} vistas</span></div>`
          ).join('')
        : '<span class="text-muted">Sin datos aún</span>';
    }

    // Tendencia
    const tendEl = q('tendenciaCrecimiento');
    if (tendEl && data.tendencia?.vistasUltimos7dias) {
      const serie = data.tendencia.vistasUltimos7dias;
      tendEl.innerHTML = `<div class="sparkline-container" id="sparklineAnalitica"></div>`;
      renderSparkline('sparklineAnalitica', serie);
    }

    // Conversión
    const convEl = q('zonasActividad');
    if (convEl) {
      convEl.innerHTML = `
        <div class="metric-big">${data.conversion ?? 0}%</div>
        <div class="metric-label">Conversión boost → vista</div>
        <div class="metric-sub">Zona: ${data.zonaId || '—'}</div>`;
    }

    // Horarios placeholder
    const horEl = q('horariosHeatmap');
    if (horEl) horEl.innerHTML = '<span class="text-muted">Disponible con más datos de actividad</span>';
  }

  // ── CAMPAÑAS / BOOST ───────────────────────────────────────────────────────
  function iniciarBoost() {
    toast('Redirigiendo al motor de Boost...', 'info');
    setTimeout(() => { window.location.href = '/boost'; }, 800);
  }

  function nuevaCampania() { toast('Módulo de campañas — próximamente', 'info'); }

  // ── Utils ──────────────────────────────────────────────────────────────────
  const q   = id => document.getElementById(id);
  const gv  = id => document.getElementById(id)?.value?.trim() || '';
  const fmtARS = n => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(n);

  function toast(msg, tipo = 'info') {
    const c = q('toastContainer'); if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${tipo}`; t.textContent = msg;
    c.appendChild(t); setTimeout(() => t.remove(), 3500);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    S.token = getToken();
    irSeccion('dashboard');
    await cargarDashboard();
    await cargarPerfil();
  }

  // ── API pública ────────────────────────────────────────────────────────────
  window.irSeccion         = irSeccion;
  window.guardarPerfil     = guardarPerfil;
  window.iniciarBoost      = iniciarBoost;
  window.nuevaCampania     = nuevaCampania;
  window.abrirNuevoProducto= abrirNuevoProducto;
  window.editarItem        = editarItem;
  window.eliminarItem      = eliminarItem;
  window.guardarProducto   = guardarProducto;
  window.cerrarModal       = cerrarModal;

  document.addEventListener('DOMContentLoaded', init);
  return { S, irSeccion };
})();
