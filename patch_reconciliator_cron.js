const fs = require("fs");
let srv = fs.readFileSync("server.js", "utf8");

const cronPatch = `
// ── PROVIDER STATE RECONCILIATOR ────────────────────────────────
cron.schedule('0 * * * *', async () => {
  try {
    const { reconcileAllProviders } = require('./src/core/services/providerStateReconciliator');
    const r = await reconcileAllProviders();
    if (r.drift > 0) {
      console.error('[STATE DRIFT] CRITICAL providers con drift detectado:', r.drift, JSON.stringify(r));
    } else {
      console.log('[Reconciliator] batch OK — total=' + r.total + ' consistent=' + r.consistent + ' errors=' + r.errors);
    }
  } catch(e) { console.error('[Reconciliator] error batch:', e.message); }
});
`;

// Insertar después del último cron existente (el de '30 * * * *')
const anchor = "cron.schedule('30 * * * *'";
const anchorEnd = srv.indexOf(anchor);
if (anchorEnd !== -1 && srv.indexOf("reconcileAllProviders") === -1) {
  // Encontrar el cierre del bloque del último cron
  let depth = 0, i = anchorEnd;
  while (i < srv.length) {
    if (srv[i] === '{') depth++;
    else if (srv[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    i++;
  }
  // Insertar después del cierre + );
  const closeIdx = srv.indexOf(');', i) + 2;
  srv = srv.slice(0, closeIdx) + '\n' + cronPatch + srv.slice(closeIdx);
  fs.writeFileSync("server.js", srv);
  console.log("OK cron reconciliator agregado");
} else if (srv.indexOf("reconcileAllProviders") !== -1) {
  console.log("ya existe");
} else {
  console.log("WARN: anchor no encontrado");
}

// Endpoint /api/admin/reconcile (on-demand)
const routePatch = `
// ── RECONCILIATOR ON-DEMAND ──────────────────────────────────────
app.get('/api/admin/reconcile', async (req, res) => {
  try {
    const { reconcileAllProviders } = require('./src/core/services/providerStateReconciliator');
    const r = await reconcileAllProviders();
    res.json({ ok: true, ...r });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});
`;

let srv2 = fs.readFileSync("server.js", "utf8");
if (srv2.indexOf("/api/admin/reconcile") === -1) {
  srv2 = srv2.replace("app.get('/health'", routePatch + "\napp.get('/health'");
  fs.writeFileSync("server.js", srv2);
  console.log("OK endpoint /api/admin/reconcile agregado");
} else { console.log("endpoint ya existe"); }
