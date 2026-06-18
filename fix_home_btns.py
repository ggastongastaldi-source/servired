path = "public/index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_btns = '''<div class="btns">
  <button class="btn btn-cyan" onclick="abrirModalConDestino('cliente')">🔍 Busco un Servicio (Cliente)</button>
  <button class="btn btn-orange" onclick="abrirModalConDestino('trabajador')">🔧 Ofrezco mis Servicios (Trabajador)</button>
  <button class="btn btn-outline" onclick="abrirModal('registro-cliente')">📝 Registrarme como Cliente</button>
  <button class="btn btn-green" onclick="abrirModal('registro-trabajador')">🔧 Registrarme como Trabajador</button>
  <button class="btn btn-outline" onclick="abrirModal('login-gen')">🔑 Ya tengo cuenta</button>
</div>'''

new_btns = '''<div class="btns">
  <button class="btn" onclick="abrirModal('onboarding-comercio')"
    style="background:linear-gradient(135deg,#0d7a6e,#0a5c52);border:1.5px solid rgba(0,229,255,0.35);color:#fff;justify-content:flex-start;padding:16px 20px;gap:16px;border-radius:16px;">
    <span style="font-size:1.8rem;flex-shrink:0;">🏪</span>
    <div style="text-align:left;">
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);font-weight:400;letter-spacing:1px;text-transform:uppercase;">Portal Comercial</div>
      <div style="font-size:1rem;font-weight:700;">Negocios</div>
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.55);font-weight:400;">Listar Empresa y Servicios</div>
    </div>
  </button>
  <button class="btn" onclick="abrirModalConDestino('cliente')"
    style="background:linear-gradient(135deg,#7a3a0d,#5c2a08);border:1.5px solid rgba(255,109,0,0.4);color:#fff;justify-content:flex-start;padding:16px 20px;gap:16px;border-radius:16px;">
    <span style="font-size:1.8rem;flex-shrink:0;">🔍</span>
    <div style="text-align:left;">
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);font-weight:400;letter-spacing:1px;text-transform:uppercase;">Área del Cliente</div>
      <div style="font-size:1rem;font-weight:700;">Buscar Servicio</div>
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.55);font-weight:400;">Encontrar Profesionales</div>
    </div>
  </button>
  <button class="btn" onclick="abrirModalConDestino('trabajador')"
    style="background:linear-gradient(135deg,#0d4a1a,#083512);border:1.5px solid rgba(57,255,20,0.3);color:#fff;justify-content:flex-start;padding:16px 20px;gap:16px;border-radius:16px;">
    <span style="font-size:1.8rem;flex-shrink:0;">🔧</span>
    <div style="text-align:left;">
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);font-weight:400;letter-spacing:1px;text-transform:uppercase;">Portal del Trabajador</div>
      <div style="font-size:1rem;font-weight:700;">Ofrecer Servicio</div>
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.55);font-weight:400;">Encontrar Trabajo y Gestionar</div>
    </div>
  </button>
</div>'''

assert old_btns in content, "ANCHOR no encontrado"
content = content.replace(old_btns, new_btns)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("OK — home buttons reemplazados")
