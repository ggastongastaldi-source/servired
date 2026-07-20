const OS = (() => {
  let _sesion = null;
  let _tema = localStorage.getItem('sr-tema') || 'dark';
  let _giaCollapsed = false;
  let _sessionState = 'PENDING'; // PENDING | AUTHENTICATED | LOGIN_REQUIRED

  // ── Splash ────────────────────────────────
  const SPLASH_MSGS = [
    'Iniciando SINAPSIS...','Conectando Event Bus...','Cargando GIA...','Verificando Trust & Risk...','Sistema listo.'
  ];
  let _splashIdx = 0;
  const _splashInterval = setInterval(() => {
    const el = document.getElementById('sp-msg');
    if (el && _splashIdx < SPLASH_MSGS.length) {
      el.style.animation = 'msg-in 0.3s ease both';
      el.textContent = SPLASH_MSGS[_splashIdx++];
      el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
    } else {
      clearInterval(_splashInterval);
    }
  }, 520);

  function _hideSplash() {
    try {
      clearInterval(_splashInterval);
      const sp = document.getElementById('splash-screen');
      if (sp) { sp.classList.add('fade-out'); setTimeout(() => { if(sp.parentNode) sp.parentNode.removeChild(sp); }, 500); }
      const shell = document.getElementById('os-shell'); if (shell) shell.style.display = '';
      const bn = document.getElementById('bottom-nav'); if (bn) bn.style.display = '';
      const fab = document.getElementById('gia-fab'); if (fab) fab.style.display = '';
    } catch(e) {
      document.getElementById('sp-msg').textContent = 'HIDE ERR: ' + e.message;
    }
  }

  // ── Tema ──────────────────────────────────
  function _applyTheme(t) {
    _tema = t;
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('theme-btn').textContent = t === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('sr-tema', t);
  }

  function toggleTheme() {
    _applyTheme(_tema === 'dark' ? 'light' : 'dark');
  }

  // ── Router ────────────────────────────────
  function nav(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item, .bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    if (history.pushState) history.pushState(null, '', '#' + view);
    window.scrollTo(0, 0);
    // Despachar init del modulo correspondiente
    const _mods = { territorial: typeof TER!=='undefined'&&TER, comercial: typeof COM!=='undefined'&&COM, profesional: typeof PRO!=='undefined'&&PRO, cliente: typeof CLI!=='undefined'&&CLI, industrial: typeof IND!=='undefined'&&IND };
    if (_mods[view] && typeof _mods[view].init === 'function') _mods[view].init();
  }

  function _routeHash() {
    const h = location.hash.replace('#','') || 'home';
    nav(h);
  }

  // ── Auth ──────────────────────────────────
  async function _checkSession() {
    try {
      const token = localStorage.getItem('sr-token');
      if (!token) { _showLogin(); return; }
      // Timeout de 12s para cold start de Render free tier
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      let r;
      try {
        r = await fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + token },
          signal: controller.signal
        });
      } finally { clearTimeout(tid); }
      if (!r || !r.ok) { localStorage.removeItem('sr-token'); _showLogin(); return; }
      const d = await r.json();
      if (!d.ok) { localStorage.removeItem('sr-token'); _showLogin(); return; }
      _sesion = d.snapshot;
      _onAuthenticated(d.snapshot);
    } catch(e) {
      console.warn('[OS] Session check failed:', e.message);
      _showLogin();
    }
  }

  function _showLogin() {
    _sessionState = 'LOGIN_REQUIRED';
    _hideSplash();
    nav('landing');
  }

  // ── Nav dinámica por rol ─────────────────
  const NAV_CONFIG = {
    admin:      [
      { view:'home',        icon:'🏠', label:'Inicio' },
      { view:'territorial', icon:'🗺️', label:'Territorio' },
      { view:'comercial',   icon:'🏪', label:'Comercial' },
      { view:'perfil',      icon:'👤', label:'Perfil' }
    ],
    comercio:   [
      { view:'home',      icon:'🏠', label:'Inicio' },
      { view:'comercial', icon:'📦', label:'Pedidos', center:true },
      { view:'perfil',    icon:'👤', label:'Perfil' }
    ],
    trabajador: [
      { view:'home',        icon:'🏠', label:'Inicio' },
      { view:'profesional', icon:'🔧', label:'Trabajos', center:true },
      { view:'perfil',      icon:'👤', label:'Perfil' }
    ],
    cliente:    [
      { view:'home',   icon:'🏠', label:'Inicio' },
      { view:'cliente',icon:'🔍', label:'Buscar', center:true },
      { view:'perfil', icon:'👤', label:'Perfil' }
    ],
    fabricante: [
      { view:'home',       icon:'🏠', label:'Inicio' },
      { view:'industrial', icon:'🏭', label:'Producción', center:true },
      { view:'perfil',     icon:'👤', label:'Perfil' }
    ]
  };

  function _buildNav(rol) {
    const bn = document.getElementById('bottom-nav');
    if (!bn) return;
    const rolKey = (rol || 'cliente').toLowerCase();
    const items = NAV_CONFIG[rolKey] || NAV_CONFIG.cliente;
    bn.innerHTML = items.map(item => {
      const isCenter = item.center;
      const cls = isCenter ? 'bn-item bn-publish' : 'bn-item';
      const inner = isCenter
        ? `<div class="bn-publish-inner"><span class="bn-icon">${item.icon}</span><span class="bn-label">${item.label}</span></div>`
        : `<span class="bn-icon">${item.icon}</span><span class="bn-label">${item.label}</span>`;
      return `<button class="${cls}" data-view="${item.view}" onclick="OS.nav('${item.view}')">${inner}</button>`;
    }).join('');
    bn.style.display = 'flex';
    // Marcar activo
    bn.querySelectorAll('[data-view]').forEach(el => {
      el.classList.toggle('active', el.dataset.view === 'home');
    });
  }


  function _buildDrawer(rol) {
    const container = document.getElementById('drawer-nav-items');
    if (!container) return;
    const rolKey = (rol || 'cliente').toLowerCase();

    const DRAWER_CONFIG = {
      admin: [
        { view:'home',        icon:'🏠', label:'Inicio' },
        { section: 'Administración' },
        { view:'territorial', icon:'🗺️', label:'Centro Territorial' },
        { view:'comercial',   icon:'🏪', label:'Centro Comercial' },
        { view:'profesional', icon:'👷', label:'Centro Profesional' },
        { view:'industrial',  icon:'🏭', label:'Centro Industrial' },
        { section: 'Gobernanza' },
        { view:'gia-full',    icon:'🧠', label:'GIA Intel' },
        { view:'perfil',      icon:'👤', label:'Mi Perfil' },
      ],
      cliente: [
        { view:'home',    icon:'🏠', label:'Inicio' },
        { section: 'Mi Actividad' },
        { view:'cliente', icon:'🔍', label:'Buscar servicios' },
        { view:'cliente', icon:'📋', label:'Mis solicitudes' },
        { section: 'ServiRed' },
        { view:'gia-full',icon:'🧠', label:'GIA Asistente' },
        { view:'perfil',  icon:'👤', label:'Mi Perfil' },
      ],
      trabajador: [
        { view:'home',        icon:'🏠', label:'Inicio' },
        { section: 'Mi Trabajo' },
        { view:'profesional', icon:'🔧', label:'Centro Profesional' },
        { view:'profesional', icon:'📋', label:'Solicitudes disponibles' },
        { view:'profesional', icon:'⭐', label:'Mi reputación' },
        { view:'perfil',      icon:'💰', label:'Mi billetera' },
        { section: 'ServiRed' },
        { view:'gia-full',    icon:'🧠', label:'GIA Asistente' },
        { view:'perfil',      icon:'👤', label:'Mi Perfil' },
      ],
      comercio: [
        { view:'home',      icon:'🏠', label:'Inicio' },
        { section: 'Mi Negocio' },
        { view:'comercial', icon:'🏪', label:'Centro Comercial' },
        { view:'comercial', icon:'📦', label:'Productos' },
        { view:'comercial', icon:'📋', label:'Pedidos' },
        { view:'comercial', icon:'📊', label:'Analítica' },
        { section: 'Crecimiento' },
        { view:'gia-full',  icon:'🧠', label:'GIA Asistente' },
        { view:'perfil',    icon:'👤', label:'Perfil comercial' },
      ],
      fabricante: [
        { view:'home',       icon:'🏠', label:'Inicio' },
        { section: 'Mi Producción' },
        { view:'industrial', icon:'🏭', label:'Centro Industrial' },
        { view:'industrial', icon:'📦', label:'Catálogo producción' },
        { view:'industrial', icon:'📊', label:'Demandas recibidas' },
        { section: 'Herramientas' },
        { view:'gia-full',   icon:'🧠', label:'GIA Asistente' },
        { view:'perfil',     icon:'👤', label:'Mi Perfil' },
      ],
      publico: [
        { view:'home',    icon:'🏠', label:'Inicio' },
        { section: 'Descubrir' },
        { view:'cliente', icon:'🔍', label:'Buscar servicios' },
        { view:'home',    icon:'🔧', label:'Ofrecer servicios' },
        { view:'home',    icon:'🏪', label:'Registrar comercio' },
        { view:'home',    icon:'🏭', label:'Registrar PyME/Fábrica' },
        { section: 'ServiRed' },
        { view:'gia-full',icon:'🧠', label:'GIA Asistente' },
      ],
    };

        const items = DRAWER_CONFIG[rolKey] || DRAWER_CONFIG.cliente;
    container.innerHTML = items.map(item => {
      if (item.section) {
        return `<div style="padding:8px 8px 4px;font-size:0.62rem;font-family:var(--font-mono);color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;">${item.section}</div>`;
      }
      return `<button class="nav-item" data-view="${item.view}" onclick="OS.nav('${item.view}');OS.closeDrawer()"><span class="nav-icon">${item.icon}</span> ${item.label}</button>`;
    }).join('');
  }

  async function _onAuthenticated(sesion) {
    if (_sessionState === 'AUTHENTICATED') return; // evitar doble ejecución
    _sessionState = 'AUTHENTICATED';
    // Normalizar contrato de sesion (snapshot usa role, usuario usa rol)
    sesion.rol  = (sesion.rol  || sesion.role  || 'cliente').toLowerCase();
    sesion.role = sesion.rol;
    sesion.nombre = sesion.nombre || sesion.name || 'Usuario';
    sesion.avatar = sesion.avatar || sesion.picture || null;
    document.getElementById('modal-login').classList.remove('show');
    _buildNav(sesion.rol || sesion.role);
    _buildDrawer(sesion.rol || sesion.role);

    // Avatar / initials
    const nombre = sesion.nombre || sesion.name || sesion.usuario?.nombre || 'Actor';
    const initials = nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('avatar-initials').textContent = initials;
    document.getElementById('home-nombre').textContent = nombre.split(' ')[0];
    document.getElementById('home-avatar-initials').textContent = initials;
    document.getElementById('perfil-nombre').textContent = nombre;
    document.getElementById('perfil-email').textContent = sesion.email || '';

    if (sesion.picture || sesion.avatar) {
      const img = document.getElementById('home-avatar-img');
      img.src = sesion.picture || sesion.avatar;
      img.style.display = '';
      document.getElementById('home-avatar-initials').style.display = 'none';
    }

    // Role label
    const roleMap = {
      admin:'Centro Estratégico · Admin', cliente:'Centro del Cliente',
      trabajador:'Centro Profesional', comercio:'Centro Comercial',
      fabricante:'Centro Industrial', pyme:'Centro Industrial'
    };
    document.getElementById('home-role-label').textContent =
      roleMap[sesion.role] || 'Sistema Operativo Económico · AMBA';

    // Onboarding + Legal compliance
    const legalOk = await _checkLegalCompliance();
    if (!legalOk && _pendingLegalDocs.length > 0) {
      _showLegalModal(_pendingLegalDocs);
    } else if (sesion.needsRoleSelection) {
      document.getElementById('modal-onboarding').classList.add('show');
    } else {
      // Navegar al centro según rol
      const rolNav = {
        'admin': 'home', 'comercio': 'comercial',
        'trabajador': 'profesional', 'fabricante': 'industrial',
        'cliente': 'home'
      };
      const rol = sesion.rol || sesion.role || '';
      const destino = rolNav[rol.toLowerCase()] || 'home';
      setTimeout(() => nav(destino), 100);
    }

    _hideSplash();
    _routeHash();
    _loadGIA();
    _loadKPIs();
  }

  // ── Google Login callback ─────────────────
  window.onGoogleLogin = async function(credential) {
    try {
      const r = await fetch('/api/auth/google', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id_token: credential.credential })
      });
      const d = await r.json();
      if (d.ok) {
        localStorage.setItem('sr-token', d.token);
        _sesion = d.usuario;
        _onAuthenticated(d.usuario);
      } else {
        console.error('[OS] Google login rejected:', d.error);
      }
    } catch(e) {
      console.error('[OS] Google login error:', e);
    }
  };

  // ── Role selection ────────────────────────
  async function selectRole(role) {
    try {
      await fetch('/api/auth/role', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ role })
      });
    } catch(e) {}
    document.getElementById('modal-onboarding').classList.remove('show');
  }

  // ── Legal compliance ──────────────────────
  let _pendingLegalDocs  = [];
  let _checkedLegalTypes = new Set();

  async function _checkLegalCompliance() {
    try {
      const r = await fetch('/api/legal/compliance');
      if (!r.ok) return true; // fail-open
      const d = await r.json();
      if (d.ok) return true;
      _pendingLegalDocs = d.pending || [];
      return false;
    } catch(e) {
      return true; // fail-open ante error de red
    }
  }

  function _showLegalModal(docs) {
    const list = document.getElementById('legal-docs-list');
    _checkedLegalTypes.clear();
    list.innerHTML = docs.map(doc => {
      const labels = {
        terms_of_use:   'Términos y Condiciones',
        privacy_policy: 'Política de Privacidad',
        ai_policy:      'Política de Inteligencia Artificial',
        merchant_agreement: 'Acuerdo de Comercio',
        worker_agreement:   'Acuerdo de Profesional',
        cookies_policy:     'Política de Cookies',
        data_processing_policy: 'Política de Procesamiento de Datos',
      };
      const label = labels[doc.type] || doc.type;
      return `
        <div style="background:var(--surface2);border-radius:8px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;">
          <input type="checkbox" id="chk-${doc.type}"
            style="margin-top:3px;accent-color:var(--orange);width:16px;height:16px;flex-shrink:0;"
            onchange="OS._onLegalCheck('${doc.type}', this.checked)">
          <label for="chk-${doc.type}" style="font-size:0.82rem;color:var(--text);cursor:pointer;flex:1;">
            He leído y acepto
            <button onclick="OS.viewLegalDoc('${doc.type}')"
              style="background:none;border:none;color:var(--cyan);cursor:pointer;font-size:0.82rem;text-decoration:underline;padding:0;">
              ${label}
            </button>
            <span style="font-size:0.68rem;color:var(--muted);display:block;margin-top:2px;">${doc.version}</span>
          </label>
        </div>`;
    }).join('');
    document.getElementById('modal-legal').classList.add('show');
    _updateLegalBtn();
  }

  function _onLegalCheck(type, checked) {
    if (checked) _checkedLegalTypes.add(type);
    else _checkedLegalTypes.delete(type);
    _updateLegalBtn();
  }

  function _updateLegalBtn() {
    const allChecked = _pendingLegalDocs.every(d => _checkedLegalTypes.has(d.type));
    const btn = document.getElementById('legal-accept-btn');
    if (!btn) return;
    btn.style.opacity        = allChecked ? '1'    : '0.4';
    btn.style.pointerEvents  = allChecked ? 'auto' : 'none';
  }

  async function acceptLegal() {
    const btn = document.getElementById('legal-accept-btn');
    const err = document.getElementById('legal-error');
    if (btn) { btn.textContent = 'Registrando...'; btn.style.pointerEvents = 'none'; }
    try {
      const r = await fetch('/api/legal/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTypes: [..._checkedLegalTypes], context: 'registration' }),
      });
      const d = await r.json();
      if (d.ok) {
        document.getElementById('modal-legal').classList.remove('show');
        if (_sesion) _onAuthenticated(_sesion); // retomar flujo
      } else {
        if (err) { err.style.display = 'block'; err.textContent = d.error || 'Error al registrar. Intentá nuevamente.'; }
        if (btn) { btn.textContent = 'Aceptar y continuar'; btn.style.pointerEvents = 'auto'; }
      }
    } catch(e) {
      if (err) { err.style.display = 'block'; err.textContent = 'Error de conexión. Intentá nuevamente.'; }
      if (btn) { btn.textContent = 'Aceptar y continuar'; btn.style.pointerEvents = 'auto'; }
    }
  }

  async function viewLegalDoc(type) {
    try {
      const r = await fetch('/api/legal/documents/' + type);
      const d = await r.json();
      if (!d.ok) return;
      const doc = d.document;
      document.getElementById('legal-viewer-title').textContent   = doc.title;
      document.getElementById('legal-viewer-version').textContent = doc.version + ' · Vigente desde ' + new Date(doc.effectiveAt).toLocaleDateString('es-AR');
      document.getElementById('legal-viewer-content').textContent = doc.content;
      document.getElementById('modal-legal-viewer').classList.add('show');
    } catch(e) { console.warn('[OS] viewLegalDoc error:', e); }
  }

  // ── Logout ────────────────────────────────
  async function logout() {
    try { await fetch('/api/auth/logout', { method:'POST' }); } catch(e) {}
    localStorage.removeItem('sr-token');
    _sesion = null;
    location.reload();
  }

  // ── GIA ───────────────────────────────────
  async function _loadGIA() {
    try {
      const r = await fetch('/api/gia/priority');
      if (!r.ok) return;
      const d = await r.json();
      const insight = d.topInsight || d.recommendation || d.mensaje || 'Sistema operativo activo.';
      document.getElementById('gia-insight-txt').textContent = insight;
      document.getElementById('gia-status-txt').textContent = '🟢 Analizando economía';
      if (d.oportunidades !== undefined) document.getElementById('gia-oportunidades').textContent = d.oportunidades;
      if (d.riesgos !== undefined)       document.getElementById('gia-riesgos').textContent = d.riesgos;
      if (d.actores !== undefined)       document.getElementById('gia-actores-act').textContent = d.actores;
      if (d.insights !== undefined)      document.getElementById('gia-insights-n').textContent = d.insights;
      if (d.kpiInsights)                 document.getElementById('kpi-gia').textContent = d.kpiInsights;
    } catch(e) {
      document.getElementById('gia-insight-txt').textContent = 'SINAPSIS conectado. Esperando eventos.';
    }
  }

  // ── KPIs ──────────────────────────────────
  async function _loadKPIs() {
    // Actores
    try {
      const r = await fetch('/api/users/count');
      if (r.ok) { const d = await r.json(); document.getElementById('kpi-actores').textContent = d.count ?? '—'; }
    } catch(e) {}
    // Pedidos hoy
    try {
      const r = await fetch('/api/pedidos/count-today');
      if (r.ok) { const d = await r.json(); document.getElementById('kpi-pedidos').textContent = d.count ?? '—'; }
    } catch(e) {}
    // Trust propio
    try {
      const r = await fetch('/api/trust/me');
      if (r.ok) { const d = await r.json(); document.getElementById('kpi-trust').textContent = d.score ?? d.trustScore ?? '—'; }
    } catch(e) {}
  }

  // ── GIA toggle ────────────────────────────
  function toggleGIA() {
    _giaCollapsed = !_giaCollapsed;
    document.getElementById('gia-widget').classList.toggle('collapsed', _giaCollapsed);
    document.getElementById('gia-toggle').textContent = _giaCollapsed ? '▸' : '▾';
  }

  function toggleGiaMobile() {
    const w = document.getElementById('gia-widget');
    w.classList.toggle('mobile-open');
  }

  // ── Drawer ────────────────────────────────
  function openDrawer() {
    document.getElementById('drawer').classList.add('show');
    document.getElementById('drawer-overlay').classList.add('show');
  }
  function closeDrawer() {
    document.getElementById('drawer').classList.remove('show');
    document.getElementById('drawer-overlay').classList.remove('show');
  }

  // ── Init ──────────────────────────────────
  function _init() {
    _applyTheme(_tema);

    // Theme btn
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);

    // Menu btn
    document.getElementById('menu-btn').addEventListener('click', openDrawer);

    // GIA toggle
    document.getElementById('gia-header').addEventListener('click', toggleGIA);

    // Nav items (sidebar + drawer)
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => {
        const v = el.dataset.view;
        if (v) nav(v);
      });
    });

    // Hash routing
    window.addEventListener('popstate', _routeHash);

    // Activar centros al navegar
    const _origNav = nav;
    window._navHooks = { territorial: () => TER.init(), comercial: () => COM.init() };
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => {
        const v = el.dataset.view;
        if (v && window._navHooks[v]) window._navHooks[v]();
      });
    });

    // Session
    setTimeout(() => _checkSession(), 2800);
    setTimeout(() => { if (_sessionState === 'PENDING') { _showLogin(); } }, 4000);
    // Safety: si en 6s el splash sigue visible, forzar hide
    setTimeout(() => {
      if (_sessionState !== 'PENDING') return; // ya resolvió, no interferir
      const sp = document.getElementById('splash-screen');
      if (sp) { sp.classList.add('fade-out'); setTimeout(() => sp.remove(), 500); }
      const shell = document.getElementById('os-shell');
      if (shell) shell.style.display = '';
      const bn = document.getElementById('bottom-nav');
      if (bn) bn.style.display = '';
      const fab = document.getElementById('gia-fab');
      if (fab) fab.style.display = '';
    }, 6000);
  }

  return { nav, toggleTheme, toggleGIA, toggleGiaMobile, openDrawer, closeDrawer, selectRole, logout, acceptLegal, viewLegalDoc, _onLegalCheck, _init };
})();
