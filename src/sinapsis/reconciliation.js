// reconciliation.js — detecta drift comparando último estado
const ledger = require('./ledger');

function reconcile() {
  const entries = ledger.all();
  if (entries.length === 0) return { status: 'UNKNOWN', reason: 'ledger vacío' };

  const last = entries[entries.length - 1];

  // drift: última entrada tiene resultado FAILED sin recovery posterior
  if (last.result?.status === 'FAILED') {
    return { status: 'FAILED_STATE', reason: `último evento falló: ${last.event?.type}`, last };
  }

  // drift: decisión DENY o ESCALATE sin ningún OK posterior
  const lastOK = [...entries].reverse().find(e => e.result?.status === 'OK');
  const lastFail = [...entries].reverse().find(e => e.decision !== 'ALLOW');

  if (lastFail && (!lastOK || lastFail.timestamp > lastOK.timestamp)) {
    return { status: 'FAILED_STATE', reason: `decisión no-ALLOW sin recovery: ${lastFail.decision}`, last };
  }

  return { status: 'CONSISTENT', entries_count: entries.length, last_hash: last.result?.state_hash };
}

module.exports = { reconcile };
