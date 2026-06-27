// ── WIZARD PROVIDER ─────────────────────────────────────────
async function iniciarWizardProvider(overlayAnterior) {
  if (overlayAnterior) overlayAnterior.remove();
  const token = localStorage.getItem("token");
  try {
    await fetch("/api/onboarding/provider/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ source: "google_oauth" })
    });
  } catch(e) { console.warn("[Wizard] start error:", e.message); }
  window.__wizData = {};
  mostrarWizardStep(1);
}

function mostrarWizardStep(step) {
  const existing = document.getElementById("wizard-provider-overlay");
  if (existing) existing.remove();
  const o = document.createElement("div");
  o.id = "wizard-provider-overlay";
  o.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,14,26,0.98);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px;box-sizing:border-box;overflow-y:auto;";
  const stepNames = ["Tus datos","Tu oficio","Tu zona","Confirmacion"];
  const barra = stepNames.map(function(s,i){
    var a = i+1===step ? "color:#00E5FF;border-bottom:2px solid #00E5FF;" : "color:#374151;border-bottom:2px solid #374151;";
    return "<span style='flex:1;text-align:center;padding-bottom:6px;font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;"+a+"'>"+s+"</span>";
  }).join("");
  var inner = document.createElement("div");
  inner.style.cssText = "max-width:400px;width:100%;";
  inner.innerHTML = "<div style='text-align:center;margin-bottom:20px;'><div style='color:#FF6D00;font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;'>Paso "+step+" de 4</div><div style='display:flex;gap:0;'>"+barra+"</div></div><div id='wiz-step-content'></div>";
  o.appendChild(inner);
  document.body.appendChild(o);
  var c = document.getElementById("wiz-step-content");
  if (step===1) renderStep1(c);
  else if (step===2) renderStep2(c);
  else if (step===3) renderStep3(c);
  else if (step===4) renderStep4(c);
}

function btn(label, onclick, bg, color) {
  var b = document.createElement("button");
  b.textContent = label;
  b.onclick = onclick;
  b.style.cssText = "width:100%;background:"+bg+";color:"+color+";border:none;padding:14px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:600;cursor:pointer;margin-top:8px;";
  return b;
}

function field(labelText, inputId, type, placeholder, value) {
  var d = document.createElement("div");
  d.style.marginBottom = "14px";
  d.innerHTML = "<label style='display:block;font-size:0.72rem;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;'>"+labelText+"</label>";
  var inp = document.createElement("input");
  inp.id = inputId; inp.type = type; inp.placeholder = placeholder; inp.value = value||"";
  inp.style.cssText = "width:100%;background:#1a2236;border:1px solid #374151;color:#e2e8f0;padding:12px;border-radius:8px;font-size:0.95rem;box-sizing:border-box;";
  d.appendChild(inp);
  return d;
}

function renderStep1(c) {
  var p = document.createElement("p");
  p.style.cssText = "color:#64748b;font-size:0.85rem;margin-bottom:20px;";
  p.textContent = "Primero lo basico. Como te llamas y como te contactamos?";
  c.appendChild(p);
  c.appendChild(field("Nombre completo","wiz-nombre","text","Ej: Juan Martinez",window.__wizData.nombre));
  c.appendChild(field("Telefono","wiz-tel","tel","Ej: 1123456789",window.__wizData.telefono));
  c.appendChild(btn("Continuar ->", wizardNext1, "#FF6D00", "#fff"));
}

function renderStep2(c) {
  var p = document.createElement("p");
  p.style.cssText = "color:#64748b;font-size:0.85rem;margin-bottom:16px;";
  p.textContent = "Cual es tu oficio principal?";
  c.appendChild(p);
  var grid = document.createElement("div");
  grid.id = "rubro-grid";
  grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;";
  var rubros = ["electricidad","plomeria","gasista","pintura","albanileria","carpinteria","cerrajeria","climatizacion","limpieza","fletes","jardineria","informatica","cctv","herreria","vidriera"];
  rubros.forEach(function(r){
    var b = document.createElement("button");
    b.textContent = r;
    if (window.__wizData.category===r) { b.style.cssText="background:#FF6D00;color:#fff;border:1px solid #FF6D00;padding:10px 12px;border-radius:8px;font-size:0.82rem;cursor:pointer;"; }
    else { b.style.cssText="background:#1a2236;color:#e2e8f0;border:1px solid #374151;padding:10px 12px;border-radius:8px;font-size:0.82rem;cursor:pointer;"; }
    b.onclick = function(){ wizSelRubro(b,r); };
    grid.appendChild(b);
  });
  c.appendChild(grid);
  var err = document.createElement("div");
  err.id="wiz-rubro-err"; err.style.cssText="color:#ef4444;font-size:0.78rem;margin-bottom:8px;display:none;";
  err.textContent="Selecciona un oficio para continuar.";
  c.appendChild(err);
  c.appendChild(btn("Continuar ->", wizardNext2, "#FF6D00", "#fff"));
  c.appendChild(btn("<- Volver", function(){ mostrarWizardStep(1); }, "transparent", "#64748b"));
}

function renderStep3(c) {
  var p = document.createElement("p");
  p.style.cssText = "color:#64748b;font-size:0.85rem;margin-bottom:16px;";
  p.textContent = "En que zona trabajas principalmente?";
  c.appendChild(p);
  var grid = document.createElement("div");
  grid.id = "zona-grid";
  grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;";
  var zonas = ["la_matanza","lomas_de_zamora","quilmes","lanus","moron","tres_de_febrero","merlo","moreno","tigre","san_isidro","avellaneda","san_martin","ezeiza","caba"];
  zonas.forEach(function(z){
    var b = document.createElement("button");
    b.textContent = z.replace(/_/g," ");
    if (window.__wizData.serviceZone===z) { b.style.cssText="background:#00E5FF;color:#0a0e1a;border:1px solid #00E5FF;padding:10px 12px;border-radius:8px;font-size:0.82rem;cursor:pointer;"; }
    else { b.style.cssText="background:#1a2236;color:#e2e8f0;border:1px solid #374151;padding:10px 12px;border-radius:8px;font-size:0.82rem;cursor:pointer;"; }
    b.onclick = function(){ wizSelZona(b,z); };
    grid.appendChild(b);
  });
  c.appendChild(grid);
  var err = document.createElement("div");
  err.id="wiz-zona-err"; err.style.cssText="color:#ef4444;font-size:0.78rem;margin-bottom:8px;display:none;";
  err.textContent="Selecciona una zona para continuar.";
  c.appendChild(err);
  c.appendChild(btn("Continuar ->", wizardNext3, "#FF6D00", "#fff"));
  c.appendChild(btn("<- Volver", function(){ mostrarWizardStep(2); }, "transparent", "#64748b"));
}

function renderStep4(c) {
  var d = window.__wizData;
  var p = document.createElement("p");
  p.style.cssText = "color:#64748b;font-size:0.85rem;margin-bottom:16px;";
  p.textContent = "Revisa tus datos antes de publicarte.";
  c.appendChild(p);
  var card = document.createElement("div");
  card.style.cssText = "background:#111827;border-radius:10px;padding:16px;margin-bottom:20px;";
  card.innerHTML = "<div style='margin-bottom:8px;'><span style='color:#64748b;font-size:0.75rem;'>NOMBRE</span><div style='color:#e2e8f0;'>"+(d.nombre||"-")+"</div></div>"
    +"<div style='margin-bottom:8px;'><span style='color:#64748b;font-size:0.75rem;'>TELEFONO</span><div style='color:#e2e8f0;'>"+(d.telefono||"-")+"</div></div>"
    +"<div style='margin-bottom:8px;'><span style='color:#64748b;font-size:0.75rem;'>OFICIO</span><div style='color:#FF6D00;'>"+(d.category||"-")+"</div></div>"
    +"<div><span style='color:#64748b;font-size:0.75rem;'>ZONA</span><div style='color:#00E5FF;'>"+((d.serviceZone||"-").replace(/_/g," "))+"</div></div>";
  c.appendChild(card);
  c.appendChild(btn("Publicarme ahora", wizardCompletar, "#39ff14", "#0a0e1a"));
  c.appendChild(btn("<- Volver", function(){ mostrarWizardStep(3); }, "transparent", "#64748b"));
}

function wizSelRubro(b, r) {
  document.querySelectorAll("#rubro-grid button").forEach(function(x){ x.style.background="#1a2236"; x.style.color="#e2e8f0"; x.style.borderColor="#374151"; });
  b.style.background="#FF6D00"; b.style.color="#fff"; b.style.borderColor="#FF6D00";
  window.__wizData.category = r;
}

function wizSelZona(b, z) {
  document.querySelectorAll("#zona-grid button").forEach(function(x){ x.style.background="#1a2236"; x.style.color="#e2e8f0"; x.style.borderColor="#374151"; });
  b.style.background="#00E5FF"; b.style.color="#0a0e1a"; b.style.borderColor="#00E5FF";
  window.__wizData.serviceZone = z;
}

function wizardNext1() {
  var nombre = document.getElementById("wiz-nombre").value.trim();
  var tel = document.getElementById("wiz-tel").value.trim();
  if (!nombre) { document.getElementById("wiz-nombre").style.borderColor="#ef4444"; return; }
  window.__wizData.nombre = nombre;
  window.__wizData.telefono = tel;
  mostrarWizardStep(2);
}

function wizardNext2() {
  if (!window.__wizData.category) { document.getElementById("wiz-rubro-err").style.display="block"; return; }
  mostrarWizardStep(3);
}

function wizardNext3() {
  if (!window.__wizData.serviceZone) { document.getElementById("wiz-zona-err").style.display="block"; return; }
  mostrarWizardStep(4);
}

async function wizardCompletar() {
  var allBtns = document.querySelectorAll("#wizard-provider-overlay button");
  allBtns.forEach(function(b){ b.disabled=true; });
  var token = localStorage.getItem("token");
  try {
    var r = await fetch("/api/onboarding/provider/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ category: window.__wizData.category, serviceZone: window.__wizData.serviceZone, nombre: window.__wizData.nombre, telefono: window.__wizData.telefono })
    });
    var data = await r.json();
    if (data.ok) { mostrarActivacionExitosa(); }
    else { alert("Error: " + data.error); allBtns.forEach(function(b){ b.disabled=false; }); }
  } catch(e) { alert("Error de conexion. Intenta de nuevo."); allBtns.forEach(function(b){ b.disabled=false; }); }
}

function mostrarActivacionExitosa() {
  var o = document.getElementById("wizard-provider-overlay");
  if (!o) return;
  var d = window.__wizData;
  o.innerHTML = "<div style='max-width:400px;width:100%;text-align:center;padding-top:60px;margin:0 auto;'>"
    +"<div style='font-size:3rem;margin-bottom:16px;'>&#9889;</div>"
    +"<h2 style='color:#39ff14;font-family:Rajdhani,sans-serif;font-size:1.6rem;margin-bottom:8px;'>Ya estas publicado!</h2>"
    +"<p style='color:#e2e8f0;font-size:0.95rem;margin-bottom:8px;'>Tu negocio ya puede recibir consultas en ServiRed.</p>"
    +"<p style='color:#64748b;font-size:0.82rem;margin-bottom:32px;'>"+(d.category||"").replace(/_/g," ")+" - "+(d.serviceZone||"").replace(/_/g," ")+"</p>"
    +"<button onclick='location.reload()' style='background:#FF6D00;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-size:1rem;font-family:Rajdhani,sans-serif;font-weight:600;cursor:pointer;'>Ver mi perfil -></button>"
    +"</div>";
}
