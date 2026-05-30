const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, body, correlationId, aggregateId }) {
  const result = await resend.emails.send({
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
