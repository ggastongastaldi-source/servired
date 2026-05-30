// gateway.js — API entry point SEP-v1 (reemplaza eventBridge para distributed mode)
const http        = require('http');
const streams     = require('./streams');
const ledgerPg    = require('./ledgerPg');
const reconciliation = require('../sinapsis/reconciliation');
const crypto      = require('crypto');

const PORT = process.env.SEP_PORT || 4001;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', d => b += d);
    req.on('end', () => { try { resolve(JSON.parse(b||'{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    // POST /action — publica en stream, responde inmediato
    if (req.method === 'POST' && req.url === '/action') {
      const body = await readBody(req);
      const event = {
        ...body,
        idempotency_key: body.idempotency_key || crypto.randomUUID(),
        entity_id:       body.entity_id       || body.actor || 'global',
        causal_seq:      body.causal_seq       ?? ((await ledgerPg.lastSeq(body.entity_id || body.actor || 'global')) + 1),
      };
      await streams.publish('sep:events', event);
      res.writeHead(202);
      return res.end(JSON.stringify({ accepted: true, idempotency_key: event.idempotency_key }));
    }

    // GET /state
    if (req.method === 'GET' && req.url === '/state') {
      const state = reconciliation.reconcile();
      res.writeHead(200);
      return res.end(JSON.stringify(state));
    }

    // GET /history/:entity_id
    if (req.method === 'GET' && req.url.startsWith('/history/')) {
      const eid = decodeURIComponent(req.url.split('/history/')[1]);
      const h   = await ledgerPg.history(eid);
      res.writeHead(200);
      return res.end(JSON.stringify(h));
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

async function start() {
  const mongoose = require('mongoose');
  const path = require('path'), fs = require('fs');
  const envPath = path.join(__dirname, '../../.env');
  if (!process.env.MONGO_URI && fs.existsSync(envPath)) {
    fs.readFileSync(envPath,'utf8').split('\n').filter(l=>l&&l[0]!=='#').forEach(l=>{
      const i=l.indexOf('='); if(i>0) process.env[l.slice(0,i)]=l.slice(i+1);
    });
  }
  await mongoose.connect(process.env.MONGO_URI);
  server.listen(PORT, () => {
    console.log(`🚀 SEP-v1 Gateway :${PORT}`);
    console.log(`   POST /action         — publish event`);
    console.log(`   GET  /state          — reconciliation`);
    console.log(`   GET  /history/:eid   — entity ledger\n`);
  });
}

start().catch(err => { console.error(err); process.exit(1); });
