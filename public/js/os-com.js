const COM = (() => {
  let _token = null;
  let _dashboard = null;
  let _activeTab = 'catalogo';

  function getToken() {
    if (!_token) _token = localStorage.getItem('sr-token');
    return _token;
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
  }

  async function init() {
    _token = localStorage.getItem('sr-token');
    await loadDashboard();
  }

  async function loadDashboard() {
    try {
      const r = await fetch('/api/merchant/dashboard', { headers: authHeaders() });
      if (r.status === 404) {
        document.getElementById('com-sin-perfil').style.display = '';
        document.getElementById('com-dashboard').style.display = 'none';
        return;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      _dashboard = await r.json();

      document.getElementById('com-sin-perfil').style.display = 'none';
      document.getElementById('com-dashboard').style.display = '';

      document.getElementById('com-nombre-comercial').textContent = _dashboard.nombreComercial || 'Mi Comercio';
      document.getElementById('com-subtitle').textContent = (_dashboard.estado || 'ACTIVO') + ' · ServiRed OS';
      const estadoBadge = document.getElementById('com-estado-badge');
      estadoBadge.textContent = _dashboard.estado || 'COMERCIO';
      estadoBadge.className = 'badge ' + (_dashboard.estado === 'ACTIVE' ? 'badge-green' : 'badge-orange');

      const a = _dashboard.actividad || {};
      document.getElementById('com-vistas').textContent      = a.vistasHoy ?? '0';
      document.getElementById('com-solicitudes').textContent  = a.solicitudesHoy ?? '0';
      document.getElementById('com-concretados').textContent  = a.pedidosConcretados ?? '0';
      document.getElementById('com-calificacion').textContent = a.calificacion ? a.calificacion.toFixed(1) : '—';

      const ing = _dashboard.ingresos?.estimadoMes || 0;
      document.getElementById('com-ingresos').textContent = ing > 0 ? '$ ' + ing.toLocaleString('es-AR') : '—';
      document.getElementById('com-campanias').textContent = _dashboard.campanias?.activas ?? '0';

      const serie = _dashboard.tendencia?.vistasUltimos7dias || [];
      if (serie.length) {
        const max = Math.max(...serie, 1);
        document.getElementById('com-trend-bars').innerHTML = serie.map((v, i) => {
          const h = Math.max(4, Math.round((v/max)*56));
          const dias = ['L','M','X','J','V','S','D'];
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
            <div style="width:100%;height:${h}px;background:var(--cyan);border-radius:3px 3px 0 0;opacity:0.8;"></div>
            <span style="font-size:0.55rem;color:var(--muted);">${dias[i]||i}</span>
          </div>`;
        }).join('');
      }

      const totalActividad = (a.vistasHoy||0) + (a.solicitudesHoy||0);
      const giaMsg = totalActividad > 0
        ? `Hoy tu negocio tuvo ${a.vistasHoy||0} vista(s) y ${a.solicitudesHoy||0} solicitud(es). ${a.pedidosConcretados||0} pedido(s) concretados.`
        : 'GIA monitoreando tu negocio. Completá tu catálogo para atraer más clientes.';
      document.getElementById('com-gia-txt').textContent = giaMsg;

      loadTrust();
      await loadCatalogo();
      if (_activeTab === 'analitica') await loadAnalytics();

    } catch(e) {
      document.getElementById('com-subtitle').textContent = 'Error: ' + e.message;
      console.error('[COM] dashboard:', e);
    }
  }

  async function loadTrust() {
    try {
      const r = await fetch('/api/trust/me', { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        const score = d.score ?? 100;
        const badge = document.getElementById('com-trust-badge');
        badge.textContent = 'Trust ' + score;
        badge.className = 'badge ' + (score >= 80 ? 'badge-green' : score >= 60 ? 'badge-gold' : 'badge-orange');
      }
    } catch(e) {}
  }

  async function loadCatalogo() {
    const el = document.getElementById('com-catalogo-list');
    try {
      const r = await fetch('/api/merchant/catalog', { headers: authHeaders() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const items = d.items || [];
      document.getElementById('com-cat-count').textContent = items.length + ' item(s) en catálogo';

      if (!items.length) {
        el.innerHTML = '<div class="alert alert-info"><span class="alert-icon">📦</span>Tu catálogo está vacío. Agregá productos o servicios.</div>';
        return;
      }

      el.innerHTML = items.map(item => {
        const precio = item.precio ? '$ ' + item.precio.toLocaleString('es-AR') : '—';
        const estadoColor = item.estado === 'ACTIVE' ? 'badge-green' : 'badge-muted';
        return `<div class="card" style="margin-bottom:8px;padding:12px 16px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="flex:1;">
              <div style="font-weight:700;font-size:0.92rem;">${item.nombre || '—'}</div>
              ${item.descripcion ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:3px;">${item.descripcion.slice(0,80)}${item.descripcion.length>80?'...':''}</div>` : ''}
              <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
                <span style="font-size:0.85rem;font-weight:700;color:var(--cyan);font-family:var(--font-mono);">${precio}</span>
                <span class="badge ${estadoColor}" style="font-size:0.6rem;">${item.estado||'—'}</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    } catch(e) {
      el.innerHTML = '<div class="alert alert-warn"><span class="alert-icon">⚠️</span>Error cargando catálogo.</div>';
    }
  }

  async function loadPedidos() {
    const el = document.getElementById('com-pedidos-list');
    el.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;text-align:center;padding:16px;">Cargando...</div>';
    try {
      const r = await fetch('/api/pedidos?estado=PENDING,EN_CURSO&limit=20', { headers: authHeaders() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const pedidos = d.pedidos || d.data || d || [];
      if (!pedidos.length) {
        el.innerHTML = '<div class="alert alert-info"><span class="alert-icon">✅</span>No hay pedidos activos en este momento.</div>';
        return;
      }
      el.innerHTML = pedidos.map(p => {
        const fecha = p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '—';
        const estadoColor = { PENDING:'badge-gold', EN_CURSO:'badge-cyan', COMPLETADO:'badge-green' }[p.estado] || 'badge-muted';
        return `<div class="card" style="margin-bottom:8px;padding:12px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:700;font-size:0.88rem;">${p.rubro||p.titulo||'Pedido'}</div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">${p.zona||''} · ${fecha}</div>
            </div>
            <span class="badge ${estadoColor}">${p.estado||'—'}</span>
          </div>
        </div>`;
      }).join('');
    } catch(e) {
      el.innerHTML = '<div class="alert alert-warn"><span class="alert-icon">⚠️</span>Error cargando pedidos.</div>';
    }
  }

  async function loadZona() {
    const el = document.getElementById('com-zona-info');
    try {
      if (!_dashboard) return;
      const zona = _dashboard.zona || _dashboard.localidad;
      if (!zona) {
        el.innerHTML = '<div class="alert alert-info"><span class="alert-icon">📍</span>Completá tu zona en el perfil para ver datos territoriales.</div>';
        return;
      }
      const zoneId = zona.toLowerCase().replace(/\s+/g,'_').replace(/[áéíóú]/g, c => ({á:'a',é:'e',í:'i',ó:'o',ú:'u'})[c]||c);
      const r = await fetch('/api/zones/' + zoneId + '/pressure');
      if (!r.ok) throw new Error('Sin datos para zona ' + zoneId);
      const z = await r.json();
      const stColor = { SHORTAGE:'var(--danger)', BALANCED:'var(--warning)', SURPLUS:'var(--cyan)' }[z.zoneState] || 'var(--muted)';
      const pct = ((z.marketPressure||0)*100).toFixed(0);
      el.innerHTML = `<div class="card">
        <div style="font-size:0.72rem;color:var(--muted);font-family:var(--font-mono);margin-bottom:8px;">ZONA · ${zoneId.replace(/_/g,' ').toUpperCase()}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:1.4rem;font-weight:700;color:${stColor};">${z.zoneState}</div>
          <div style="font-size:1.1rem;font-weight:700;font-family:var(--font-mono);">${pct}%</div>
        </div>
        <div style="background:var(--surface3);border-radius:4px;height:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${stColor};border-radius:4px;"></div>
        </div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:8px;">
          ${z.zoneState === 'SHORTAGE' ? '🔥 Alta demanda en tu zona. Buena oportunidad para destacar tu negocio.' :
            z.zoneState === 'SURPLUS' ? '🔵 Zona con mucha oferta. Diferenciá tu propuesta de valor.' :
            '🟡 Zona equilibrada. Mantené tu servicio activo.'}
        </div>
      </div>`;
    } catch(e) {
      el.innerHTML = '<div class="alert alert-warn"><span class="alert-icon">⚠️</span>' + e.message + '</div>';
    }
  }

  function tab(name) {
    _activeTab = name;
    ['catalogo','pedidos','analitica','territorial'].forEach(t => {
      document.getElementById('com-tab-' + t).style.display = t === name ? '' : 'none';
    });
    document.querySelectorAll('.com-tab').forEach(btn => {
      btn.className = 'btn btn-sm com-tab ' + (btn.dataset.tab === name ? 'btn-primary active' : 'btn-ghost');
    });
    if (name === 'pedidos') loadPedidos();
    if (name === 'territorial') loadZona();
  }

  function showCrearPerfil() { alert('Creación de perfil comercial — próximamente.'); }
  function showAddItem() { alert('Agregar item al catálogo — próximamente.'); }
  function refresh() { loadDashboard(); }

  async function loadAnalytics() {
    const box = document.getElementById('com-analitica-content');
    if (!box) return;
    try {
      const r = await fetch('/api/merchant/analytics', { headers: authHeaders() });
      if (!r.ok) { box.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center;">Sin datos disponibles.</p>'; return; }
      const { analytics: an } = await r.json();
      if (!an) return;
      const act = an.actividad || {};
      const cat = an.catalogo || {};
      const cam = an.campanias || {};
      const ing = an.ingresos || {};
      const tend = an.tendencia || {};
      box.innerHTML = `
        <div class="grid-4" style="margin-bottom:var(--sp-md);">
          <div class="kpi"><div class="kpi-icon">&#128065;</div><div class="kpi-label">Vistas hoy</div><div class="kpi-value">${act.vistasHoy??0}</div></div>
          <div class="kpi"><div class="kpi-icon">&#128172;</div><div class="kpi-label">Solicitudes</div><div class="kpi-value">${act.solicitudesHoy??0}</div></div>
          <div class="kpi"><div class="kpi-icon">&#9989;</div><div class="kpi-label">Concretados</div><div class="kpi-value">${act.pedidosConcretados??0}</div></div>
          <div class="kpi"><div class="kpi-icon">&#11088;</div><div class="kpi-label">Calificaci&#243;n</div><div class="kpi-value">${act.calificacion?act.calificacion.toFixed(1):'&#8212;'}</div></div>
        </div>
        <div class="card" style="margin-bottom:var(--sp-sm);">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;">&#128200; Ingresos estimados del mes</div>
          <div style="font-size:1.8rem;font-weight:700;color:var(--success);">$ ${(ing.estimadoMes||0).toLocaleString('es-AR')}</div>
          <div style="font-size:0.72rem;color:var(--muted);">Moneda: ${ing.moneda||'ARS'}</div>
        </div>
        <div class="card" style="margin-bottom:var(--sp-sm);">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;">&#128230; Cat&#225;logo</div>
          <div style="display:flex;gap:var(--sp-md);flex-wrap:wrap;">
            <span style="font-size:0.82rem;">&#128197; <b>${cat.totalItems??0}</b> productos</span>
            <span style="font-size:0.82rem;">&#127991; <b>${cat.enPromocion??0}</b> en promoci&#243;n</span>
            <span style="font-size:0.82rem;">&#9888;&#65039; <b>${cat.sinStock??0}</b> sin stock</span>
          </div>
        </div>
        <div class="card" style="margin-bottom:var(--sp-sm);">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;">&#128227; Campa&#241;as</div>
          <div style="display:flex;gap:var(--sp-md);flex-wrap:wrap;">
            <span style="font-size:0.82rem;">Activas: <b>${cam.activas??0}</b></span>
            <span style="font-size:0.82rem;">Vistas: <b>${cam.vistasGeneradas??0}</b></span>
            <span style="font-size:0.82rem;">Conversi&#243;n: <b>${cam.conversionRate??0}%</b></span>
          </div>
        </div>
        ${tend.vistasUltimos7dias?.length ? `
        <div class="card">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;">&#128200; Vistas &#250;ltimos 7 d&#237;as</div>
          <div style="display:flex;align-items:flex-end;gap:4px;height:60px;">
            ${(()=>{const s=tend.vistasUltimos7dias;const mx=Math.max(...s,1);const dias=['L','M','X','J','V','S','D'];return s.map((v,i)=>{const h=Math.max(4,Math.round((v/mx)*56));return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="width:100%;height:'+h+'px;background:var(--cyan);border-radius:3px 3px 0 0;opacity:0.8;"></div><span style="font-size:0.55rem;color:var(--muted);">'+(dias[i]||i)+'</span></div>';}).join('');})()}
          </div>
        </div>` : ''}`;
    } catch(e) {
      const box2 = document.getElementById('com-analitica-content');
      if (box2) box2.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center;">Error cargando analítica.</p>';
    }
  }

  return { init, refresh, tab, loadPedidos, showCrearPerfil, showAddItem };
})();
