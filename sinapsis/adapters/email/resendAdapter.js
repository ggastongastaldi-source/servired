const { Resend } = require('resend');

// Lazy singleton: NO instanciar a nivel de modulo.
// Motivo (bug real detectado 2026-07-04): instanciar aqui arriba hacia que
// cualquier require() de este archivo explotara si falta RESEND_API_KEY,
// lo cual tumbaba en cascada TODO nexus/initNexus.js (via outboxDispatcher.js),
// incluyendo changeStreamObserver — dejando MerchantProjection sin actualizar
// nunca, entre otros efectos. Ver ADR Merchant Domain Event Transport.
let _resend = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

async function sendEmail({ to, subject, body, correlationId, aggregateId }) {
  const client = getClient();
  if (!client) {
    console.warn('[Resend] RESEND_API_KEY no configurada — email no enviado (no bloquea el flujo)');
    return { ok: false, error: 'RESEND_API_KEY_MISSING' };
  }

  const result = await client.emails.send({
    from: 'SINAPSIS <onboarding@resend.dev>',
    to,
    subject,
    text: body,
    headers: {
      'x-correlation-id': correlationId,
      'x-aggregate-id':   aggregateId
    }
  });
  console.log(`[Resend] Enviado → ${result.data?.id ?? result.id}`);
  return { ok: true, providerId: result.data?.id ?? result.id };
}

module.exports = { sendEmail };
