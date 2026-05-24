const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

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
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:0.95rem;">Conectamos trabajadores con clientes reales</p>
        </div>
        <div style="padding:28px;">
          <h2 style="color:#00E5FF;">Hola ${nombre} 👋</h2>
          <p>Te identificamos como profesional de <strong>${rubroLabel}</strong> en el área metropolitana de Buenos Aires.</p>
          <p>En <strong>SERVired</strong> conectamos trabajadores verificados con clientes que necesitan servicios reales, con inteligencia artificial y pagos seguros por Mercado Pago.</p>
          <ul style="color:#94a3b8;line-height:2;">
            <li>✅ Recibís pedidos directamente en tu celular</li>
            <li>✅ Cobrás el 80% de cada trabajo</li>
            <li>✅ Pagos garantizados por Mercado Pago</li>
            <li>✅ Sin intermediarios, sin llamadas</li>
          </ul>
          <div style="text-align:center;margin:28px 0;">
            <a href="https://www.servired.online" style="background:linear-gradient(135deg,#00E5FF,#7c3aed);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1.1rem;display:inline-block;">
              🚀 Registrarme en SERVired
            </a>
          </div>
          <p style="font-size:0.8rem;color:#475569;text-align:center;">Ingresá a <a href="https://www.servired.online" style="color:#00E5FF;">www.servired.online</a> y registrate como trabajador.</p>
        </div>
      </div>
    `
  });
  console.log('[Email] Invitación enviada a:', email);
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
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:0.95rem;">Profesionales verificados, cuando los necesitás</p>
        </div>
        <div style="padding:28px;">
          <h2 style="color:#00E5FF;">Hola ${nombre} 👋</h2>
          <p>En <strong>SERVired</strong> encontrás profesionales verificados para cualquier trabajo del hogar, con presupuesto instantáneo y pago seguro.</p>
          <ul style="color:#94a3b8;line-height:2;">
            <li>🔧 Plomería, electricidad, pintura y más</li>
            <li>🤖 Presupuesto inteligente con IA</li>
            <li>✅ Trabajadores verificados con antecedentes</li>
            <li>💳 Pagos seguros por Mercado Pago</li>
          </ul>
          <div style="text-align:center;margin:28px 0;">
            <a href="https://www.servired.online" style="background:linear-gradient(135deg,#00E5FF,#7c3aed);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:1.1rem;display:inline-block;">
              🚀 Quiero un profesional ahora
            </a>
          </div>
          <p style="font-size:0.8rem;color:#475569;text-align:center;"><a href="https://www.servired.online" style="color:#00E5FF;">www.servired.online</a></p>
        </div>
      </div>
    `
  });
  console.log('[Email] Invitación cliente enviada a:', email);
}

module.exports = { enviarInvitacionWorker, enviarInvitacionCliente };
