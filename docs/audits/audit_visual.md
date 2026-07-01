# AUDITORÍA VISUAL — insumos para diseño del Command Center

## public/pulse.html — primeras 80 líneas (head + estilos inline)
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Pulse — ServiRed Comercio</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f6fa;color:#333;min-height:100vh}

/* Header */
#pulse-header{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between}
.ph-brand{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:1px}
.ph-nombre{font-size:18px;font-weight:700;margin-top:2px}
.ph-estado{display:flex;align-items:center;gap:6px;font-size:12px}
.estado-dot{width:8px;height:8px;border-radius:50%;background:#48cfad;animation:pulse-dot 2s infinite}
@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}
.estado-dot.stress{background:#ff4757;animation:none}

/* KPIs */
#pulse-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:16px}
.kpi-card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.kpi-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px}
.kpi-valor{font-size:28px;font-weight:800;margin:4px 0;color:#1a1a2e}
.kpi-sub{font-size:11px;color:#aaa}
.kpi-card.alerta .kpi-valor{color:#ff4757}
.kpi-card.ok    .kpi-valor{color:#48cfad}

/* Alertas */
#pulse-alertas{padding:0 16px 12px}
.alerta-item{background:#fff3cd;border-left:3px solid #ffc107;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#856404}
.alerta-item.critica{background:#fdecea;border-color:#ff4757;color:#c62828}
.alerta-item.ok{background:#d4edda;border-color:#48cfad;color:#155724}

/* Secciones */
.pulse-section{padding:0 16px 16px}
.pulse-section h3{font-size:13px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}

/* Productos críticos */
.prod-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0}
.prod-nombre{font-size:13px;font-weight:600}
.prod-meta{font-size:11px;color:#aaa}
.prod-badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px}
.badge-sin-stock{background:#fdecea;color:#c62828}
.badge-promo{background:#d4edda;color:#155724}

/* GIA insight */
#gia-insight{margin:16px;background:linear-gradient(135deg,#6c63ff15,#48cfad15);border:1px solid #6c63ff30;border-radius:16px;padding:16px}
.gi-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.gi-icon{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#48cfad);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px}
.gi-title{font-size:13px;font-weight:700;color:#6c63ff}
.gi-text{font-size:13px;color:#444;line-height:1.6}
.gi-loading{color:#aaa;font-size:13px;font-style:italic}

/* FAB GIA */
#gia-fab{position:fixed;bottom:28px;right:24px;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#48cfad);color:#fff;font-size:22px;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(108,99,255,.45);z-index:100;display:flex;align-items:center;justify-content:center}

/* Refresh */
#pulse-refresh{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;color:#aaa;font-size:11px;cursor:pointer}
</style>
</head>
<body>

<div id="pulse-header">
  <div>
    <div class="ph-brand">ServiRed Comercio</div>
    <div class="ph-nombre" id="ph-nombre">Cargando...</div>
  </div>
  <div class="ph-estado">
    <div class="estado-dot" id="estado-dot"></div>
    <span id="estado-label">Normal</span>
  </div>
</div>

<div id="pulse-kpis">
  <div class="kpi-card" id="kpi-solicitudes">
    <div class="kpi-label">Solicitudes hoy</div>
    <div class="kpi-valor" id="kv-solicitudes">—</div>
    <div class="kpi-sub" id="ks-pedidos">— pedidos concretados</div>
  </div>

## Variables CSS / paleta de colores usada en pulse.html
9:body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f6fa;color:#333;min-height:100vh}
12:#pulse-header{background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between}
16:.estado-dot{width:8px;height:8px;border-radius:50%;background:#48cfad;animation:pulse-dot 2s infinite}
18:.estado-dot.stress{background:#ff4757;animation:none}
22:.kpi-card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
23:.kpi-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px}
24:.kpi-valor{font-size:28px;font-weight:800;margin:4px 0;color:#1a1a2e}
25:.kpi-sub{font-size:11px;color:#aaa}
26:.kpi-card.alerta .kpi-valor{color:#ff4757}
27:.kpi-card.ok    .kpi-valor{color:#48cfad}
31:.alerta-item{background:#fff3cd;border-left:3px solid #ffc107;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#856404}
32:.alerta-item.critica{background:#fdecea;border-color:#ff4757;color:#c62828}
33:.alerta-item.ok{background:#d4edda;border-color:#48cfad;color:#155724}
37:.pulse-section h3{font-size:13px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
40:.prod-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0}
42:.prod-meta{font-size:11px;color:#aaa}
44:.badge-sin-stock{background:#fdecea;color:#c62828}
45:.badge-promo{background:#d4edda;color:#155724}
48:#gia-insight{margin:16px;background:linear-gradient(135deg,#6c63ff15,#48cfad15);border:1px solid #6c63ff30;border-radius:16px;padding:16px}
50:.gi-icon{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#48cfad);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px}
51:.gi-title{font-size:13px;font-weight:700;color:#6c63ff}
52:.gi-text{font-size:13px;color:#444;line-height:1.6}
53:.gi-loading{color:#aaa;font-size:13px;font-style:italic}
56:#gia-fab{position:fixed;bottom:28px;right:24px;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#6c63ff,#48cfad);color:#fff;font-size:22px;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(108,99,255,.45);z-index:100;display:flex;align-items:center;justify-content:center}
59:#pulse-refresh{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;color:#aaa;font-size:11px;cursor:pointer}

## public/style.css — si existe, primeras 60 líneas
/* ServiRed - estilos base */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }

## admin.html — head + primeras líneas de estilo
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SERVired — Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="/socket.io/socket.io.js"></script>
<style>
:root{--cyan:#00E5FF;--orange:#FF6D00;--bg:#05080f;--surface:#0d1321;--surface2:#111927;--text:#e2e8f0;--muted:#4a5568;--success:#10b981;--danger:#ef4444;--warn:#f59e0b;--purple:#7c3aed;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#080d19;border-bottom:1px solid rgba(0,229,255,0.1);position:sticky;top:0;z-index:100;}
.logo{font-size:0.95rem;font-weight:700;letter-spacing:3px;color:var(--cyan);font-family:'Share Tech Mono',monospace;}
.logo span{color:var(--orange);}
.live-badge{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(16,185,129,0.1);border:1px solid var(--success);font-size:0.7rem;font-family:'Share Tech Mono',monospace;color:var(--success);}
.ldot{width:6px;height:6px;border-radius:50%;background:var(--success);animation:pulse 1.2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 16px;}
.kpi{background:var(--surface);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;text-align:center;position:relative;overflow:hidden;}
.kpi::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
.kpi.c::after{background:var(--cyan);}.kpi.o::after{background:var(--orange);}.kpi.g::after{background:var(--success);}.kpi.p::after{background:var(--purple);}
.kpi-num{font-size:1.3rem;font-weight:700;font-family:'Share Tech Mono',monospace;text-shadow:0 0 10px currentColor;}
.kpi.c .kpi-num{color:var(--cyan);}.kpi.o .kpi-num{color:var(--orange);}.kpi.g .kpi-num{color:var(--success);}.kpi.p .kpi-num{color:var(--purple);}
.kpi-lbl{font-size:0.55rem;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-top:2px;}
#mapa{width:100%;height:220px;}
.legend{display:flex;gap:14px;padding:8px 16px;background:var(--surface);border-bottom:1px solid rgba(255,255,255,0.04);}
.leg-i{display:flex;align-items:center;gap:5px;font-size:0.7rem;color:#00E5FF;}
.leg-d{width:8px;height:8px;border-radius:50%;}
.tabs{display:flex;border-bottom:1px solid rgba(255,255,255,0.07);background:var(--surface);overflow-x:auto;}
.tab{flex:1;min-width:60px;padding:10px 6px;text-align:center;font-size:0.65rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;color:#cbd5e1;border-bottom:2px solid transparent;transition:all 0.2s;font-family:'Share Tech Mono',monospace;white-space:nowrap;}
.tab.active{color:var(--cyan);border-bottom-color:var(--cyan);}
.tc{display:none;padding:12px 16px 30px;}.tc.active{display:block;}
.sec-title{font-size:0.65rem;text-transform:uppercase;letter-spacing:2px;color:#00E5FF;margin-bottom:8px;font-family:'Share Tech Mono',monospace;}
.p-row{display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;}
.p-id{font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:#00E5FF;width:50px;flex-shrink:0;}
.p-info{flex:1;}.p-srv{font-weight:600;font-size:0.85rem;}.p-meta{font-size:0.7rem;color:#00E5FF;}
.badge{padding:2px 8px;border-radius:999px;font-size:0.6rem;font-weight:700;text-transform:uppercase;font-family:'Share Tech Mono',monospace;flex-shrink:0;}
.badge.PENDIENTE{background:rgba(245,158,11,0.15);color:var(--warn);border:1px solid var(--warn);}
.badge.ACEPTADA{background:rgba(0,229,255,0.1);color:var(--cyan);border:1px solid var(--cyan);}
.badge.EN_PROCESO{background:rgba(124,58,237,0.15);color:#a78bfa;border:1px solid #a78bfa;}
.badge.REALIZADA{background:rgba(16,185,129,0.1);color:var(--success);border:1px solid var(--success);}
.badge.PAGADA{background:rgba(16,185,129,0.15);color:var(--success);border:1px solid var(--success);}
.badge.CANCELADA{background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid var(--danger);}
.w-row{display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;}
.w-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),#0080ff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;font-size:0.85rem;flex-shrink:0;}
.w-info{flex:1;}.w-name{font-weight:600;font-size:0.9rem;}.w-meta{font-size:0.7rem;color:#00E5FF;}
.wdot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;}
.wdot.on{background:var(--success);animation:pulse 1.5s infinite;}.wdot.off{background:var(--muted);}
.btn-ver{padding:4px 10px;background:rgba(0,229,255,0.1);border:1px solid var(--cyan);border-radius:6px;color:var(--cyan);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;font-weight:700;}
.btn-danger{padding:4px 10px;background:rgba(239,68,68,0.1);border:1px solid var(--danger);border-radius:6px;color:var(--danger);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;font-weight:700;}
.btn-warn{padding:4px 10px;background:rgba(245,158,11,0.1);border:1px solid var(--warn);border-radius:6px;color:var(--warn);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;font-weight:700;}
.fin-row{display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;}
.fin-v{font-family:'Share Tech Mono',monospace;font-weight:700;}
.fin-v.pos{color:var(--success);}.fin-v.neg{color:var(--danger);}.fin-v.neu{color:var(--cyan);}
.feed{max-height:200px;overflow-y:auto;}
.ev{display:flex;align-items:flex-start;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem;}
.ev-t{color:#00E5FF;font-family:'Share Tech Mono',monospace;font-size:0.65rem;white-space:nowrap;}

## ¿Qué fuentes (Google Fonts / @font-face) se usan en el proyecto?
./public/admin-referidos.html:15:    font-family:'Segoe UI',system-ui,sans-serif;
./public/admin-referidos.html:50:    font-size:11px; font-family:monospace; background:rgba(0,229,255,0.1);
./public/admin-referidos.html:79:    background:#0d1420; color:var(--text); font-size:13px; font-family:inherit;
./public/admin.html:7:<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
./public/admin.html:14:body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;min-height:100vh;}
./public/admin.html:16:.logo{font-size:0.95rem;font-weight:700;letter-spacing:3px;color:var(--cyan);font-family:'Share Tech Mono',monospace;}
./public/admin.html:18:.live-badge{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(16,185,129,0.1);border:1px solid var(--success);font-size:0.7rem;font-family:'Share Tech Mono',monospace;color:var(--success);}
./public/admin.html:25:.kpi-num{font-size:1.3rem;font-weight:700;font-family:'Share Tech Mono',monospace;text-shadow:0 0 10px currentColor;}
./public/admin.html:33:.tab{flex:1;min-width:60px;padding:10px 6px;text-align:center;font-size:0.65rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;color:#cbd5e1;border-bottom:2px solid transparent;transition:all 0.2s;font-family:'Share Tech Mono',monospace;white-space:nowrap;}
./public/admin.html:36:.sec-title{font-size:0.65rem;text-transform:uppercase;letter-spacing:2px;color:#00E5FF;margin-bottom:8px;font-family:'Share Tech Mono',monospace;}
./public/admin.html:38:.p-id{font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:#00E5FF;width:50px;flex-shrink:0;}
./public/admin.html:40:.badge{padding:2px 8px;border-radius:999px;font-size:0.6rem;font-weight:700;text-transform:uppercase;font-family:'Share Tech Mono',monospace;flex-shrink:0;}
./public/admin.html:52:.btn-ver{padding:4px 10px;background:rgba(0,229,255,0.1);border:1px solid var(--cyan);border-radius:6px;color:var(--cyan);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;font-weight:700;}
./public/admin.html:53:.btn-danger{padding:4px 10px;background:rgba(239,68,68,0.1);border:1px solid var(--danger);border-radius:6px;color:var(--danger);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;font-weight:700;}
./public/admin.html:54:.btn-warn{padding:4px 10px;background:rgba(245,158,11,0.1);border:1px solid var(--warn);border-radius:6px;color:var(--warn);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;font-weight:700;}
./public/admin.html:56:.fin-v{font-family:'Share Tech Mono',monospace;font-weight:700;}
./public/admin.html:60:.ev-t{color:#00E5FF;font-family:'Share Tech Mono',monospace;font-size:0.65rem;white-space:nowrap;}
./public/admin.html:67:.cola-timer{font-family:'Share Tech Mono',monospace;font-size:0.7rem;color:var(--warn);}
./public/admin.html:75:.heat-val{font-family:'Share Tech Mono',monospace;font-size:0.7rem;color:var(--cyan);width:30px;text-align:right;}
./public/admin.html:79:.conv-num{font-size:1.8rem;font-weight:700;font-family:'Share Tech Mono',monospace;color:var(--cyan);}
./public/admin.html:94:  font-family:'Rajdhani',sans-serif !important;
./public/admin.html:134:    <button onclick="logout()" style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#ef4444;padding:4px 12px;border-radius:6px;font-size:0.7rem;font-family:'Share Tech Mono',monospace;cursor:pointer;">⏻ SALIR</button>
./public/admin.html:177:    <button onclick="filtrarWor('todos')" id="fw-todos" style="padding:4px 10px;background:rgba(0,229,255,0.15);border:1px solid var(--cyan);border-radius:6px;color:var(--cyan);font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;">TODOS</button>
./public/admin.html:178:    <button onclick="filtrarWor('online')" id="fw-online" style="padding:4px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;">ONLINE</button>
./public/admin.html:179:    <button onclick="filtrarWor('verificar')" id="fw-verificar" style="padding:4px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;font-size:0.65rem;font-family:'Share Tech Mono',monospace;cursor:pointer;">PENDIENTES</button>
./public/admin.html:408:      <div style="font-size:0.7rem;font-family:'Share Tech Mono',monospace;">
./public/admin.html:822:        <div style="font-size:0.55rem;color:#64748b;font-family:'Share Tech Mono',monospace;">${k}</div>
./public/admin.html:826:        <div style="font-size:0.55rem;color:#64748b;font-family:'Share Tech Mono',monospace;">TOTAL</div>
./public/admin.html:857:      <span style="font-size:0.6rem;padding:3px 8px;background:${color}22;border:1px solid ${color};border-radius:20px;color:${color};font-family:'Share Tech Mono',monospace;">${l.estado}</span>
./public/admin.html:939:        <div style="font-size:0.55rem;color:#64748b;font-family:'Share Tech Mono',monospace;">${k}</div>
