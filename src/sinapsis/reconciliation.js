// reconciliation.js — lee ledger MongoDB real (SEP-v1 unified)
const ledgerPg = require('../sep/ledgerPg');

async function reconcile(entity_id = null) {
  try {
    const mongoose = require('mongoose');
    // conectar si no está conectado
    if (mongoose.connection.readyState === 0) {
      const fs = require('fs'), path = require('path');
      const ep = path.join(__dirname, '../../.env');
      if (fs.existsSync(ep)) {
        fs.readFileSync(ep,'utf8').split('\n').filter(l=>l&&l[0]!=='#').forEach(l=>{
          const i=l.indexOf('='); if(i>0) process.env[l.slice(0,i)]=l.slice(i+1);
        });
      }
      await mongoose.connect(process.env.MONGO_URI);
    }

    const SepLedger = mongoose.model('SepLedger');
    const query = entity_id ? { entity_id } : {};
    const total = await SepLedger.countDocuments(query);

    if (total === 0) return { status: 'UNKNOWN', reason: 'ledger vacío' };

    // último evento global o por entidad
    const last = await SepLedger.findOne(query).sort({ ts: -1 }).lean();

    // drift: último resultado FAILED
    if (last.result?.status === 'FAILED') {
      return { status: 'FAILED_STATE', reason: 'último evento falló', entity_id: last.entity_id, last };
    }

    // drift: última decisión no-ALLOW sin OK posterior
    const lastOK   = await SepLedger.findOne({ ...query, 'result.status': 'OK' }).sort({ ts: -1 }).lean();
    const lastDeny = await SepLedger.findOne({ ...query, decision: { $ne: 'ALLOW' } }).sort({ ts: -1 }).lean();

    if (lastDeny && (!lastOK || lastDeny.ts > lastOK.ts)) {
      return {
        status: 'FAILED_STATE',
        reason: `decisión no-ALLOW sin recovery: ${lastDeny.decision}`,
        entity_id: lastDeny.entity_id,
        last: lastDeny,
      };
    }

    return {
      status: 'CONSISTENT',
      total_events: total,
      last_entity: last.entity_id,
      last_seq: last.causal_seq,
      last_hash: last.result?.state_hash,
      last_ts: last.ts,
    };
  } catch (e) {
    return { status: 'UNKNOWN', reason: e.message };
  }
}

module.exports = { reconcile };
