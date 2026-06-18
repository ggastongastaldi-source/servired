path = "public/index.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# --- 1. "Tengo un comercio" --- saca WA, abre modal onboarding
old1 = '<a class="drawer-item" style="text-decoration:none;" href="https://wa.me/5491168360746?text=Hola%2C%20quiero%20sumar%20mi%20comercio%20a%20ServiRed" target="_blank">🏪 Tengo un comercio, quiero sumarme</a>'
new1 = '<button class="drawer-item" onclick="closeDrawer();abrirModal(\'onboarding-comercio\')">🏪 Tengo un comercio, quiero sumarme</button>'
assert old1 in content, "ANCHOR 1 no encontrado"
content = content.replace(old1, new1)

# --- 2. "Ayuda / Soporte" --- saca WA, abre modal soporte
old2 = '<a class="drawer-item" style="text-decoration:none;" href="https://wa.me/5491168360746?text=Hola%2C%20necesito%20ayuda%20con%20ServiRed" target="_blank">💬 Ayuda / Soporte</a>'
new2 = '<button class="drawer-item" onclick="closeDrawer();abrirModal(\'soporte\')">💬 Ayuda / Soporte</button>'
assert old2 in content, "ANCHOR 2 no encontrado"
content = content.replace(old2, new2)

# --- 3. Modal como-funciona --- cards visuales, sin WA
old3 = '''<div class="modal-bg" id="modal-como-funciona">
  <div class="modal">
    <div class="modal-title">📖 Cómo funciona ServiRed</div>
    <p style="color:var(--text);font-size:0.95rem;line-height:1.5;margin-bottom:10px;font-weight:700;">La red que conecta vecinos, profesionales y comercios reales.</p>
    <p style="color:var(--muted);font-size:0.88rem;line-height:1.5;margin-bottom:10px;">Si necesitás un plomero, electricista, albañil o cualquier servicio para tu hogar, ServiRed te ayuda a encontrarlo.</p>
    <p style="color:var(--muted);font-size:0.88rem;line-height:1.5;margin-bottom:10px;">Si sos profesional, ServiRed te ayuda a conseguir clientes.</p>
    <p style="color:var(--muted);font-size:0.88rem;line-height:1.5;margin-bottom:10px;">Si tenés un comercio, ServiRed te permite formar parte de una red local en crecimiento.</p>
    <p style="color:var(--green);font-size:0.85rem;line-height:1.5;">Todo dentro de una plataforma diseñada para fortalecer la economía de cercanía. Bienvenido a ServiRed.</p>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-pri" onclick="cerrarModals()">Cerrar</button>
    </div>
  </div>
</div>'''

new3 = '''<div class="modal-bg" id="modal-como-funciona">
  <div class="modal" style="max-width:420px;padding:24px 20px;">
    <div class="modal-title" style="font-size:1.1rem;margin-bottom:4px;">¿Cómo funciona ServiRed?</div>
    <p style="color:var(--muted);font-size:0.8rem;text-align:center;margin-bottom:18px;">La red que conecta vecinos, profesionales y comercios reales.</p>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
      <div style="background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.25);border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:14px;">
        <span style="font-size:1.6rem;line-height:1;">🔍</span>
        <div>
          <div style="color:#00E5FF;font-size:0.88rem;font-weight:700;margin-bottom:3px;">Vecinos y usuarios</div>
          <div style="color:#ccc;font-size:0.82rem;line-height:1.45;">Encontrá plomeros, electricistas, albañiles y más. Presupuesto inmediato, pago seguro.</div>
        </div>
      </div>
      <div style="background:rgba(255,109,0,0.08);border:1px solid rgba(255,109,0,0.3);border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:14px;">
        <span style="font-size:1.6rem;line-height:1;">🔧</span>
        <div>
          <div style="color:#FF6D00;font-size:0.88rem;font-weight:700;margin-bottom:3px;">Profesionales</div>
          <div style="color:#ccc;font-size:0.82rem;line-height:1.45;">Recibí pedidos en tu zona, gestioná tu agenda y cobrá de forma segura.</div>
        </div>
      </div>
      <div style="background:rgba(0,200,83,0.08);border:1px solid rgba(0,200,83,0.25);border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:14px;">
        <span style="font-size:1.6rem;line-height:1;">🏪</span>
        <div>
          <div style="color:#00C853;font-size:0.88rem;font-weight:700;margin-bottom:3px;">Comercios</div>
          <div style="color:#ccc;font-size:0.82rem;line-height:1.45;">Sumá tu negocio a la red local. Visibilidad real, clientes reales, economía de cercanía.</div>
        </div>
      </div>
    </div>
    <p style="color:var(--muted);font-size:0.78rem;text-align:center;margin-bottom:16px;">Plataforma diseñada para fortalecer la economía de cercanía · <span style="color:#00E5FF;">servired.online</span></p>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-pri" onclick="cerrarModals()">Entendido</button>
    </div>
  </div>
</div>

<div class="modal-bg" id="modal-onboarding-comercio">
  <div class="modal" style="max-width:420px;padding:24px 20px;">
    <div class="modal-title" style="font-size:1.05rem;margin-bottom:4px;">🏪 Sumá tu comercio</div>
    <p style="color:var(--muted);font-size:0.82rem;text-align:center;margin-bottom:18px;">Formá parte de la red local más grande del AMBA.</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
      <div style="background:rgba(0,229,255,0.06);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.3rem;">📍</span>
        <div style="color:#ccc;font-size:0.82rem;line-height:1.4;">Visibilidad geolocalizada para clientes de tu barrio y zona.</div>
      </div>
      <div style="background:rgba(255,109,0,0.06);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.3rem;">🤝</span>
        <div style="color:#ccc;font-size:0.82rem;line-height:1.4;">Conectate con trabajadores verificados que operan en tu zona.</div>
      </div>
      <div style="background:rgba(0,200,83,0.06);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.3rem;">📈</span>
        <div style="color:#ccc;font-size:0.82rem;line-height:1.4;">Crecé junto a la red. Sin costo de entrada, con beneficios reales.</div>
      </div>
    </div>
    <div style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.15);border-radius:10px;padding:14px;text-align:center;margin-bottom:16px;">
      <div style="color:#00E5FF;font-size:0.82rem;font-weight:700;margin-bottom:4px;">🤖 Registro asistido por IA</div>
      <div style="color:var(--muted);font-size:0.78rem;line-height:1.4;">El proceso de alta de comercios está siendo desarrollado. Pronto podrás registrarte directamente desde la plataforma.</div>
    </div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-pri" onclick="cerrarModals()">Cerrar</button>
    </div>
  </div>
</div>

<div class="modal-bg" id="modal-soporte">
  <div class="modal" style="max-width:420px;padding:24px 20px;">
    <div class="modal-title" style="font-size:1.05rem;margin-bottom:4px;">💬 Ayuda y Soporte</div>
    <p style="color:var(--muted);font-size:0.82rem;text-align:center;margin-bottom:18px;">¿Tenés alguna pregunta o problema?</p>
    <div style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.15);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;">
      <div style="font-size:2rem;margin-bottom:8px;">🤖</div>
      <div style="color:#00E5FF;font-size:0.88rem;font-weight:700;margin-bottom:6px;">Asistente ServiRed</div>
      <div style="color:var(--muted);font-size:0.8rem;line-height:1.5;">El soporte inteligente está en desarrollo. Próximamente podrás resolver tus consultas directamente desde la plataforma, sin salir de la app.</div>
    </div>
    <div class="modal-btns">
      <button class="btn-sm btn-sm-pri" onclick="cerrarModals()">Cerrar</button>
    </div>
  </div>
</div>'''

assert old3 in content, "ANCHOR 3 no encontrado"
content = content.replace(old3, new3)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("OK — 3 anchors aplicados, WhatsApp eliminado")
