const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:servired.online1@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function enviarPushWorker(subscription, payload) {
  if (!subscription || !process.env.VAPID_PUBLIC_KEY) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('[Push] ✅ Notificación enviada');
  } catch(e) {
    if (e.statusCode === 410) {
      console.log('[Push] Suscripción expirada — remover');
      return 'expired';
    }
    console.error('[Push] Error:', e.message);
  }
}

module.exports = { enviarPushWorker };
