// eventBridge.js — único entry point, orquesta el flujo completo
const dixie          = require('./dixie');
const runtime        = require('./runtime');
const ledger         = require('./ledger');
const eye            = require('./eye');

async function process(rawInput) {
  const event = {
    type:   rawInput.type,
    actor:  rawInput.actor,
    domain: rawInput.domain,
    payload: rawInput.payload || {},
    risk:   parseFloat(rawInput.risk) || 0,
  };

  // 1) Dixie decide
  const decision = dixie.evaluate(event);

  // 2) Runtime ejecuta solo si ALLOW
  let result = null;
  if (decision === 'ALLOW') {
    result = await runtime.execute(event);
  } else {
    result = { status: 'SKIPPED', reason: decision };
  }

  // 3) Ledger — siempre
  const entry = ledger.append({ event, decision, result });

  // 4) Eye — async, no bloqueante
  eye.emit(event, decision, result);

  return { decision, result, entry_id: entry.timestamp };
}

module.exports = { process };
