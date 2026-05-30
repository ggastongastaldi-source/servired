// runtime.js — ejecuta si ALLOW, no decide
const crypto = require('crypto');

async function execute(event) {
  try {
    // ejecución determinística — state_hash del evento
    const state_hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ type: event.type, actor: event.actor, ts: Date.now() }))
      .digest('hex')
      .slice(0, 16);

    return { status: 'OK', state_hash };
  } catch (e) {
    return { status: 'FAILED', error: e.message };
  }
}

module.exports = { execute };
