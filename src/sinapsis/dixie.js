// dixie.js — policy engine, solo decide
const RISK_ESCALATE_THRESHOLD = 0.7;
const RISK_DENY_THRESHOLD     = 0.95;

const ALLOWED_DOMAINS = ['RUNTIME', 'WATCHDOG', 'CONTROL'];

function evaluate(event) {
  // isolation invariant
  if (!ALLOWED_DOMAINS.includes(event.domain)) {
    return 'DENY';
  }
  if (!event.type || !event.actor) {
    return 'DENY';
  }

  // human gate — risk threshold
  if (event.risk >= RISK_DENY_THRESHOLD)     return 'DENY';
  if (event.risk >= RISK_ESCALATE_THRESHOLD) return 'ESCALATE';

  return 'ALLOW';
}

module.exports = { evaluate };
