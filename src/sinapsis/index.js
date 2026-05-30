// index.js — HTTP server, solo 2 endpoints
const http           = require('http');
const eventBridge    = require('./eventBridge');
const reconciliation = require('./reconciliation');

const PORT = process.env.SINAPSIS_PORT || 4000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    // POST /action
    if (req.method === 'POST' && req.url === '/action') {
      const body   = await readBody(req);
      const result = await eventBridge.process(body);
      res.writeHead(200);
      return res.end(JSON.stringify(result));
    }

    // GET /state
    if (req.method === 'GET' && req.url === '/state') {
      const state = reconciliation.reconcile();
      res.writeHead(200);
      return res.end(JSON.stringify(state));
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));

  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🧠 SINAPSIS EventBridge running on :${PORT}`);
  console.log(`   POST /action  — ejecutar evento`);
  console.log(`   GET  /state   — reconciliation\n`);
});
