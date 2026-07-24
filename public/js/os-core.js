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
    // GIA Full: cargar datos reales al navegar
    if (view === 'gia-full') {
      _loadGIAFull();
      const w = document.getElementById('gia-widget');
      if (w) w.style.display = 'none';
      const fab = document.getElementById('gia-fab');
      if (fab) fab.style.display = 'none';
    } else {
      const w = document.getElementById('gia-widget');
      if (w) w.style.display = '';
      const fab = document.getElementById('gia-fab');
      if (fab) fab.style.display = '';
    }
  }

  async function _loadGIAFull(nombreParam) {
    const el = document.getElementById('gia-full-content');
    if (!el) return;

    const nombre = nombreParam
      || (typeof sesion !== 'undefined' && sesion && sesion.nombre ? sesion.nombre.split(' ')[0] : null)
      || 'vos';

    if (!window.giaHistory) window.giaHistory = [];

    const avatarHTML =
      '<img class="gia-avatar-img" src="/assets/gia-avatar.png" alt="GIA" ' +
        'onerror="this.onerror=null;this.outerHTML=\'' +
        '<div style=&quot;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#ff6d00,#ff9a00);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(255,109,0,0.25);&quot;>' +
        '<svg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; fill=&quot;none&quot;>' +
        '<circle cx=&quot;20&quot; cy=&quot;20&quot; r=&quot;20&quot; fill=&quot;rgba(0,0,0,0.15)&quot;/>' +
        '<path d=&quot;M20 8 L26 16 L20 14 L14 16 Z&quot; fill=&quot;white&quot; opacity=&quot;0.9&quot;/>' +
        '<circle cx=&quot;20&quot; cy=&quot;22&quot; r=&quot;7&quot; fill=&quot;white&quot; opacity=&quot;0.95&quot;/>' +
        '<circle cx=&quot;17&quot; cy=&quot;21&quot; r=&quot;1.5&quot; fill=&quot;#ff6d00&quot;/>' +
        '<circle cx=&quot;23&quot; cy=&quot;21&quot; r=&quot;1.5&quot; fill=&quot;#ff6d00&quot;/>' +
        '<path d=&quot;M17 25 Q20 27 23 25&quot; stroke=&quot;#ff6d00&quot; stroke-width=&quot;1.2&quot; fill=&quot;none&quot; stroke-linecap=&quot;round&quot;/>' +
        '</svg></div>\';" />';

    el.innerHTML =
      '<div class="gia-full-header" style="display:flex;flex-direction:column;align-items:center;gap:8px;">' +
        avatarHTML +
        '<div style="text-align:center;">' +
          '<div style="font-size:0.75rem;font-weight:700;color:var(--text);letter-spacing:1px;">GIA</div>' +
          '<div style="font-size:0.6rem;color:var(--muted);font-family:var(--font-mono);">Inteligencia cognitiva · ServiRed OS</div>' +
          '<div id="gia-estado-lbl" style="font-size:0.6rem;color:var(--primary);font-family:var(--font-mono);margin-top:2px;">● Observando</div>' +
        '</div>' +
      '</div>' +
      '<div id="gia-bubbles" class="gia-full-messages">' +
        '<div style="background:var(--surface2);border-left:3px solid var(--primary);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:14px 16px;align-self:flex-start;max-width:92%;">' +
          '<div style="font-size:0.62rem;color:var(--primary);font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">GIA</div>' +
          '<div style="font-size:1.05rem;color:var(--text);line-height:1.75;font-weight:400;">Hola ' + nombre + ', soy GIA, la inteligencia cognitiva de ServiRed.<br><br>Estoy observando el ecosistema. Podés preguntarme sobre oportunidades, actores, territorio u operación.</div>' +
        '</div>' +
      '</div>' +
      '<div class="gia-full-inputrow">' +
        '<button id="gia-voice-btn" onclick="GIA_VA&&GIA_VA.toggle()" ' +
          'style="padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:var(--r-sm);font-size:1rem;cursor:pointer;flex-shrink:0;" title="Mantené presionado para hablar">🎤</button>' +
        '<input id="gia-chat-input" type="text" placeholder="Preguntale a GIA..." ' +
          'onkeydown="if(event.key==\'Enter\')_giaEnviar()" ' +
          'style="flex:1;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:1.05rem;outline:none;" />' +
        '<button onclick="_giaEnviar()" ' +
          'style="padding:10px 16px;background:transparent;border:2px solid var(--primary);border-radius:var(--r-sm);color:var(--primary);font-size:1.1rem;font-weight:700;cursor:pointer;flex-shrink:0;">→</button>' +
      '</div>';

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('sr_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const endpoint = token ? '/api/gia/priority/personal' : '/api/gia/priority';
      const r = await fetch(endpoint, { headers });
      if (r.ok) {
        const d = await r.json();
        if (d.ok && d.topInsight) {
          _giaBurbuja('gia', d.topInsight);
        }
      }
    } catch(e) { /* silencioso */ }
  }

  function _giaStatCard(label, val) {
    return '<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px;text-align:center;">'+
      '<div style="font-size:1.2rem;font-weight:700;color:var(--cyan);font-family:var(--font-mono);">' + (val !== undefined ? val : '—') + '</div>'+
      '<div style="font-size:0.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>'+
    '</div>';
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
    _buildDrawerPublico();
  }

  function _buildDrawerPublico() {
    const container = document.getElementById('drawer-nav-items');
    if (!container) return;
    const items = [
      { view:'landing',  icon:'🏠', label:'Inicio' },
      { section: 'Descubrir' },
      { view:'landing',  icon:'🔍', label:'Buscar un servicio' },
      { view:'landing',  icon:'🔧', label:'Ofrecer mis servicios' },
      { view:'landing',  icon:'🏪', label:'Registrar mi comercio' },
      { section: 'ServiRed' },
      { view:'gia-full', icon:'🧠', label:'GIA Intelligence' },
      { view:'quienes',  icon:'ℹ️', label:'Quiénes somos' },
    ];
    container.innerHTML = items.map(item => {
      if (item.section) {
        return `<div style="padding:8px 8px 4px;font-size:0.62rem;font-family:var(--font-mono);color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;">${item.section}</div>`;
      }
      return `<button class="nav-item" data-view="${item.view}" onclick="OS.nav('${item.view}');OS.closeDrawer()"><span class="nav-icon">${item.icon}</span> ${item.label}</button>`;
    }).join('');
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
        { view:'gia-full',icon:'🧠', label:'GIA Intel' },
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
        { view:'gia-full',    icon:'🧠', label:'GIA Intel' },
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
        { view:'gia-full',  icon:'🧠', label:'GIA Intel' },
        { view:'perfil',    icon:'👤', label:'Perfil comercial' },
      ],
      fabricante: [
        { view:'home',       icon:'🏠', label:'Inicio' },
        { section: 'Mi Producción' },
        { view:'industrial', icon:'🏭', label:'Centro Industrial' },
        { view:'industrial', icon:'📦', label:'Catálogo producción' },
        { view:'industrial', icon:'📊', label:'Demandas recibidas' },
        { section: 'Herramientas' },
        { view:'gia-full',   icon:'🧠', label:'GIA Intel' },
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
        { view:'gia-full',icon:'🧠', label:'GIA Intel' },
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
    // GIA Drawer — saludo personalizado
    const drawerName = document.getElementById('gia-drawer-name');
    const drawerRole = document.getElementById('gia-drawer-role');
    const drawerActions = document.getElementById('gia-drawer-actions');
    const primerNombre = (sesion.nombre || 'Usuario').split(' ')[0];
    // Si GIA Full ya está visible, recargar con nombre real
    if (document.getElementById('view-gia-full') && document.getElementById('view-gia-full').classList.contains('active')) {
      _loadGIAFull(primerNombre);
    }
    if (drawerName) drawerName.textContent = 'Hola, ' + primerNombre + '.';
    const ROLE_LABELS = {
      admin:'Administrador ServiRed', cliente:'Cliente', trabajador:'Profesional',
      comercio:'Comercio', fabricante:'Industria / Fabricante'
    };
    if (drawerRole) drawerRole.textContent = ROLE_LABELS[sesion.rol] || 'ServiRed OS';
    const ROLE_ACTIONS = {
      admin: [
        { icon:'🗺️', label:'Centro Territorial', view:'territorial' },
        { icon:'👷', label:'Centro Profesional', view:'profesional' },
        { icon:'🏪', label:'Centro Comercial',   view:'comercial' },
        { icon:'🧠', label:'GIA Intelligence',   view:'gia-full' },
      ],
      cliente: [
        { icon:'🔍', label:'Buscar servicios',   view:'cliente' },
        { icon:'📋', label:'Mis solicitudes',    view:'cliente' },
        { icon:'🧠', label:'GIA Intel',          view:'gia-full' },
      ],
      trabajador: [
        { icon:'⚡', label:'Ver oportunidades',  view:'profesional' },
        { icon:'📋', label:'Solicitudes activas',view:'profesional' },
        { icon:'⭐', label:'Mi reputación',      view:'profesional' },
        { icon:'🧠', label:'GIA Intel',          view:'gia-full' },
      ],
      comercio: [
        { icon:'📦', label:'Mis productos',      view:'comercial' },
        { icon:'📋', label:'Pedidos',            view:'comercial' },
        { icon:'📊', label:'Analítica',          view:'comercial' },
        { icon:'🧠', label:'GIA Intel',          view:'gia-full' },
      ],
      fabricante: [
        { icon:'🏭', label:'Mi producción',      view:'industrial' },
        { icon:'📊', label:'Demandas recibidas', view:'industrial' },
        { icon:'🧠', label:'GIA Intel',          view:'gia-full' },
      ],
    };
    const actions = ROLE_ACTIONS[sesion.rol] || ROLE_ACTIONS.cliente;
    if (drawerActions) {
      drawerActions.innerHTML = actions.map(a =>
        `<button class="gia-drawer-action-btn" onclick="OS.nav('${a.view}');OS.closeDrawer()">
          <span>${a.icon}</span> ${a.label}
        </button>`
      ).join('');
    }

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
      // Widget desktop
      document.getElementById('gia-insight-txt').textContent = insight;
      document.getElementById('gia-status-txt').textContent = '🟢 Inteligencia territorial activa';
      if (d.oportunidades !== undefined) document.getElementById('gia-oportunidades').textContent = d.oportunidades;
      if (d.riesgos !== undefined)       document.getElementById('gia-riesgos').textContent = d.riesgos;
      if (d.actores !== undefined)       document.getElementById('gia-actores-act').textContent = d.actores;
      if (d.insights !== undefined)      document.getElementById('gia-insights-n').textContent = d.insights;
      if (d.kpiInsights)                 document.getElementById('kpi-gia').textContent = d.kpiInsights;
      // GIA Drawer — responde al contrato de estado (no infiere comportamiento)
      const setD = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
      const drawerInsight = document.getElementById('gia-drawer-insight-txt');
      if (drawerInsight) drawerInsight.textContent = insight;
      setD('gia-drawer-actores',       d.actores);
      setD('gia-drawer-oportunidades', d.oportunidades);
      setD('gia-drawer-riesgos',       d.riesgos);
      setD('gia-drawer-insights',      d.insights);
      // Aplicar estado cognitivo desde el contrato
      const drawerEl = document.getElementById('drawer');
      if (drawerEl && d.state) {
        drawerEl.dataset.giaState = d.state;
      }
      // Accion recomendada desde el backend
      const actionsEl = document.getElementById('gia-drawer-actions');
      if (actionsEl && d.action && d.state !== 'IDLE') {
        const existing = actionsEl.querySelector('[data-gia-action]');
        if (!existing) {
          const btn = document.createElement('button');
          btn.className = 'gia-drawer-action-btn';
          btn.dataset.giaAction = 'primary';
          btn.style.cssText = 'background:rgba(255,109,0,0.15);border-color:rgba(255,109,0,0.4);font-weight:700;';
          btn.innerHTML = '<span>⚡</span> ' + d.action.label;
          btn.onclick = () => { OS.nav(d.action.view); OS.closeDrawer(); };
          actionsEl.insertBefore(btn, actionsEl.firstChild);
        }
      }
    } catch(e) {
      document.getElementById('gia-insight-txt').textContent = 'SINAPSIS conectado. Esperando eventos.';
      const drawerInsight = document.getElementById('gia-drawer-insight-txt');
      if (drawerInsight) drawerInsight.textContent = 'SINAPSIS conectado. Esperando eventos.';
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
    window._navHooks = { territorial: () => TER.init(), comercial: () => COM.init(), quienes: () => { if(window._qsObserverInit) window._qsObserverInit(); } };
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


// ── BOTTOM NAV GLOBAL HELPERS ─────────────────────────────────
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
  const modal = document.getElementById('modal-nuevo-pedido') ||
                document.getElementById('modal-pedido') ||
                document.getElementById('modal-soporte');
  if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
}

// ── GIA WIDGET HYDRATION ──────────────────────────────────────
async function giaHydrate() {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('sr_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const endpoint = token ? '/api/gia/priority/personal' : '/api/gia/priority';
    const r = await fetch(endpoint, { headers });
    if (!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error('ok=false');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val !== null && val !== undefined) ? String(val) : '0'; };
    set('gia-oportunidades', d.oportunidades);
    set('gia-riesgos',       d.riesgos);
    set('gia-actores-act',   d.actores);
    set('gia-insights-n',    d.insights);
    const insightEl = document.getElementById('gia-insight-txt');
    if (insightEl && d.topInsight) insightEl.textContent = d.topInsight;
    const statusEl = document.getElementById('gia-status-txt');
    if (statusEl) { const m = { IDLE:'Sistema operativo', ALERT:'⚠ Alerta activa', RECOMMENDATION:'💡 Recomendación disponible' }; statusEl.textContent = m[d.state] || 'Inteligencia territorial activa'; }
    const drawerEl = document.getElementById('gia-drawer-insight-txt');
    if (drawerEl && d.topInsight) drawerEl.textContent = d.topInsight;
  } catch(e) {
    console.warn('[GIA] hydrate:', e.message);
    const insightEl = document.getElementById('gia-insight-txt');
    if (insightEl) insightEl.textContent = 'Sistema operativo. Inteligencia territorial activa.';
  }
}

// Auto-hydrate GIA al cargar y cada 60s
document.addEventListener('DOMContentLoaded', () => {
  giaHydrate();
  setInterval(giaHydrate, 60000);
});

// ── GIA COPILOTO — funciones de conversación ─────────────────
// ── GIA Voice Assistant ──────────────────────────────
const GIA_VA = (function() {
  let rec = null;
  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz.'); return; }
    const btn = document.getElementById('gia-voice-btn');
    const status = document.getElementById('gia-estado-lbl');
    rec = new SR();
    rec.lang = 'es-AR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    if (btn) btn.style.background = 'rgba(255,107,53,0.4)';
    if (status) status.textContent = '● Escuchando...';
    rec.onresult = function(e) {
      const texto = e.results[0][0].transcript;
      console.log('[GIA_VA] transcripción:', texto);
      const input = document.getElementById('gia-chat-input');
      if (input) { input.value = texto; }
      _active = false;
      stop();
      _giaEnviar();
    };
    rec.onerror = function(e) {
      console.log('[GIA_VA] error:', e.error);
      stop();
      // Mostrar error visible en pantalla para debug mobile
      const estadoEl = document.getElementById('gia-estado-lbl');
      if (estadoEl) estadoEl.textContent = '● Error mic: ' + e.error;
      _giaBurbuja('gia', 'Micrófono: ' + e.error + '. Verificá permisos en Chrome → Configuración del sitio.');
    };
    rec.onend = function() { console.log('[GIA_VA] onend'); _active = false; stop(); };
    rec.start();
    console.log('[GIA_VA] iniciado');
  }
  function stop() {
    if (rec) { try { rec.stop(); } catch(e){} rec = null; }
    const btn = document.getElementById('gia-voice-btn');
    const status = document.getElementById('gia-estado-lbl');
    if (btn) btn.style.background = 'rgba(255,255,255,0.06)';
    if (status) status.textContent = '● Observando';
  }
  let _active = false;
  function toggle() {
    if (_active) { _active = false; stop(); }
    else { _active = true; start(); }
  }
  return { start, stop, toggle };
})();

function _giaBurbuja(rol, texto) {
  const box = document.getElementById('gia-bubbles');
  if (!box) return;
  const div = document.createElement('div');
  const esGia = rol === 'gia';
  div.style.cssText = esGia
    ? 'background:var(--surface2);border-left:3px solid var(--primary);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:12px 14px;max-width:92%;align-self:flex-start;'
    : 'background:rgba(255,109,0,0.15);border-right:3px solid var(--primary);border-radius:var(--r-sm) 0 0 var(--r-sm);padding:12px 14px;text-align:right;max-width:92%;align-self:flex-end;color:var(--text);';
  div.innerHTML =
    '<div style="font-size:0.72rem;color:var(--primary);font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">' +
      (esGia ? 'GIA' : 'Vos') +
    '</div>' +
    '<div style="font-size:1.05rem;color:var(--text);line-height:1.75;font-weight:400;">' + texto + '</div>';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function _giaEnviar() {
  const input = document.getElementById('gia-chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  if (!window.giaHistory) window.giaHistory = [];
  window.giaHistory.push({ role: 'user', content: msg });
  _giaBurbuja('user', msg);

  // Estado: analizando
  const estadoEl = document.getElementById('gia-estado-lbl');
  if (estadoEl) estadoEl.textContent = '● Analizando...';
  input.disabled = true;

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('sr_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const r = await fetch('/api/asistente', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: window.giaHistory,
        appMode: typeof AppMode !== 'undefined' ? AppMode.get() : null,
        correlationId: typeof SessionContext !== 'undefined' ? SessionContext.getCorrelationId() : null
      })
    });
    const d = await r.json();
    const reply = d.reply || 'No pude procesar tu consulta en este momento.';
    window.giaHistory.push({ role: 'assistant', content: reply });
    _giaBurbuja('gia', reply);
    if (typeof speak === 'function') speak(reply);
    if (estadoEl) estadoEl.textContent = '● Observando';
  } catch(e) {
    _giaBurbuja('gia', 'Error de conexión. Intentá de nuevo.');
    if (estadoEl) estadoEl.textContent = '● Observando';
  } finally {
    input.disabled = false;
    input.focus();
  }
}
