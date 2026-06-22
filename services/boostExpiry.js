const Commerce = require('../src/core/models/Commerce');

async function expireBoosts() {
  try {
    const result = await Commerce.updateMany(
      { is_boosted: true, boost_expires_at: { $lt: new Date() } },
      { $set: { is_boosted: false, boost_expires_at: null } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[BOOST EXPIRY] ${result.modifiedCount} boost(s) expirados`);
    }
  } catch (err) {
    console.error('[BOOST EXPIRY] Error:', err.message);
  }
}

function startBoostExpiryCron() {
  // Correr al inicio
  expireBoosts();
  // Luego cada hora
  setInterval(expireBoosts, 60 * 60 * 1000);
  console.log('[BOOST EXPIRY] Cron iniciado (intervalo: 1h)');
}

module.exports = { startBoostExpiryCron };
