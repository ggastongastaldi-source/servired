const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

async function enviarBienvenidaWorker({ nombre, email, especialidades = [] }) {
  const rubros = especialidades.slice(0,3).map(e => e.replace(/_/g,' ')).join(', ') || 'servicios';
  await transporter.sendMail({
    from: `"SERVired" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `¡Bienvenido a SERVired, ${nombre}! Tu perfil está siendo verificado 🚀`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00E5FF,#7c3aed);padding:28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:1.8rem;">SERVired</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);">Conectamos trabajadores verificados con clientes reales</p>
  </div>
  <div style="padding:28px;">
    <h2 style="color:#00E5FF;">¡Hola ${nombre}! 👷</h2>
    <p>Tu perfil como profesional de <strong>${rubros}</strong> fue recibido correctamente.</p>
    <p>Nuestro equipo lo está verificando. En cuanto esté aprobado, vas a empezar a recibir pedidos directamente en tu celular.</p>
    <div style="background:#1a2236;border-radius:10px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#00E5FF;font-weight:700;">¿Qué sigue?</p>
      <ul style="margin:0;padding-left:18px;color:#94a3b8;line-height:2;">
        <li>✅ Verificación de tu perfil (24-48hs)</li>
        <li>📱 Activás disponibilidad desde la app</li>
        <li>🔔 Recibís notificación de pedidos cercanos</li>
        <li>💳 Cobrás el 80% por Mercado Pago</li>
      </ul>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://www.servired.online" style="background:linear-gradient(135deg,#00E5FF,#7c3aed);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1rem;display:inline-block;">
        📱 Ir a SERVired
      </a>
    </div>
    <p style="font-size:0.8rem;color:#475569;text-align:center;">¿Tenés dudas? Respondé este mail y te ayudamos.</p>
  </div>
</div>`
  });
  console.log('[Email] Bienvenida worker enviada a:', email);
}

async function enviarBienvenidaCliente({ nombre, email }) {
  await transporter.sendMail({
    from: `"SERVired" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `¡Bienvenido a SERVired, ${nombre}! Encontrá profesionales verificados 🔧`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00E5FF,#7c3aed);padding:28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:1.8rem;">SERVired</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);">Profesionales verificados, cuando los necesitás</p>
  </div>
  <div style="padding:28px;">
    <h2 style="color:#00E5FF;">¡Hola ${nombre}! 👋</h2>
    <p>Tu cuenta en <strong>SERVired</strong> está lista. Ya podés pedir profesionales verificados para cualquier trabajo.</p>
    <div style="background:#1a2236;border-radius:10px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#00E5FF;font-weight:700;">¿Cómo funciona?</p>
      <ul style="margin:0;padding-left:18px;color:#94a3b8;line-height:2;">
        <li>🔍 Elegís el servicio que necesitás</li>
        <li>🤖 La IA te da un presupuesto al instante</li>
        <li>👷 Un profesional verificado llega a tu casa</li>
        <li>💳 Pagás seguro por Mercado Pago</li>
      </ul>
    </div>
    <div style="background:#1a2236;border-radius:10px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#00E5FF;font-weight:700;">Servicios disponibles</p>
      <p style="margin:0;color:#94a3b8;font-size:0.9rem;">🔧 Plomería · ⚡ Electricidad · 🎨 Pintura · 🔥 Gasista · 🧹 Limpieza · 🔑 Cerrajería · 🌿 Jardinería · y más de 25 rubros</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://www.servired.online" style="background:linear-gradient(135deg,#00E5FF,#7c3aed);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1rem;display:inline-block;">
        🚀 Pedir un profesional ahora
      </a>
    </div>
    <p style="font-size:0.8rem;color:#475569;text-align:center;">¿Necesitás ayuda? Respondé este mail.</p>
  </div>
</div>`
  });
  console.log('[Email] Bienvenida cliente enviada a:', email);
}

async function enviarInvitacionWorker({ nombre, rubro, email }) {
  const rubroLabel = rubro ? rubro.replace(/_/g,' ') : 'servicios';
  await transporter.sendMail({
    from: `"SERVired" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${nombre}, te invitamos a trabajar en SERVired 🚀`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00E5FF,#7c3aed);padding:28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:1.8rem;">SERVired</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);">Conectamos trabajadores con clientes reales</p>
  </div>
  <div style="padding:28px;">
    <h2 style="color:#00E5FF;">Hola ${nombre} 👋</h2>
    <p>Te identificamos como profesional de <strong>${rubroLabel}</strong> en el área de Buenos Aires.</p>
    <p>En <strong>SERVired</strong> conectamos trabajadores verificados con clientes que necesitan servicios, con IA y pagos seguros por Mercado Pago.</p>
    <ul style="color:#94a3b8;line-height:2;">
      <li>✅ Recibís pedidos en tu celular</li>
      <li>✅ Cobrás el 80% de cada trabajo</li>
      <li>✅ Pagos garantizados por Mercado Pago</li>
      <li>✅ Sin intermediarios</li>
    </ul>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://www.servired.online" style="background:linear-gradient(135deg,#00E5FF,#7c3aed);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1.1rem;display:inline-block;">
        🚀 Registrarme en SERVired
      </a>
    </div>
  </div>
</div>`
  });
  console.log('[Email] Invitación worker enviada a:', email);
}

async function enviarInvitacionCliente({ nombre, email }) {
  await transporter.sendMail({
    from: `"SERVired" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${nombre}, encontrá profesionales verificados en SERVired 🔧`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#00E5FF,#7c3aed);padding:28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:1.8rem;">SERVired</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);">Profesionales verificados, cuando los necesitás</p>
  </div>
  <div style="padding:28px;">
    <h2 style="color:#00E5FF;">Hola ${nombre} 👋</h2>
    <p>En <strong>SERVired</strong> encontrás profesionales verificados para cualquier trabajo del hogar.</p>
    <ul style="color:#94a3b8;line-height:2;">
      <li>🔧 Plomería, electricidad, pintura y más</li>
      <li>🤖 Presupuesto inteligente con IA</li>
      <li>✅ Trabajadores verificados</li>
      <li>💳 Pagos seguros por Mercado Pago</li>
    </ul>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://www.servired.online" style="background:linear-gradient(135deg,#00E5FF,#7c3aed);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1.1rem;display:inline-block;">
        🚀 Quiero un profesional ahora
      </a>
    </div>
  </div>
</div>`
  });
  console.log('[Email] Invitación cliente enviada a:', email);
}

module.exports = { enviarBienvenidaWorker, enviarBienvenidaCliente, enviarInvitacionWorker, enviarInvitacionCliente };
