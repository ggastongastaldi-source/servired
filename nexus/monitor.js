// Nexus Monitor v1.2 — Termux simple sin cursor positioning
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const POLL_MS   = 5000;
const MAX_EVENTS = 10;

const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m',
};
const fn = (c, t) => `${C[c]}${t}${C.reset}`;
const sep = fn('gray', '  ────────────────────────────────────');

async function getSnapshot() {
  const now  = new Date();
  const min1 = new Date(now - 60000);
  const min5 = new Date(now - 300000);
  const [total, em1, em5, ultimos, jobs, leads, zonas] = await Promise.all([
    mongoose.connection.collection('events').countDocuments(),
    mongoose.connection.collection('events').countDocuments({ timestamp: { $gte: min1 } }),
    mongoose.connection.collection('events').countDocuments({ timestamp: { $gte: min5 } }),
    mongoose.connection.collection('events').find({}).sort({ timestamp: -1 }).limit(MAX_EVENTS).toArray(),
    mongoose.connection.collection('proj_jobs').countDocuments(),
    mongoose.connection.collection('proj_leads').countDocuments(),
    mongoose.connection.collection('proj_zona_metrics').find({}).sort({ completados: -1 }).limit(3).toArray(),
    mongoose.connection.collection('shadow_metrics_log').find({}).sort({ timestamp: -1 }).limit(1).toArray()
  ]);
  return { total, em1, em5, ultimos, jobs, leads, zonas };
}

function render(s) {
  const now = new Date().toLocaleTimeString('es-AR');
  const L = [];

  L.push(fn('bold', fn('cyan', '╔══════════════════════════════════╗')));
  L.push(fn('bold', fn('cyan', '║  NEXUS MONITOR v1.2 — ServiRed   ║')));
  L.push(fn('bold', fn('cyan', '╚══════════════════════════════════╝')));
  L.push(`  ${fn('gray','Hora:')} ${fn('green', now)}   ${fn('green','● LIVE')}`);
  L.push(sep);
  L.push(`  ${fn('yellow','EVENTOS')}   Total: ${fn('cyan', String(s.total))}   /min: ${fn('green', String(s.em1))}   /5min: ${fn('green', String(s.em5))}`);
  L.push(`  ${fn('yellow','PROJ')}      Jobs:  ${fn('cyan', String(s.jobs))}   Leads: ${fn('cyan', String(s.leads))}`);

  if (s.zonas.length) {
    L.push(sep);
    L.push(`  ${fn('yellow','TOP ZONAS')}`);
    s.zonas.forEach(z => {
      L.push(`  ${fn('green',(z.zona||'?').padEnd(14))} ${(z.rubro||'?').padEnd(14)} ${fn('cyan',String(z.completados||0))} jobs`);
    });
  }

  L.push(sep);
  // Shadow metrics
  try {
    const sh = await mongoose.connection.collection('shadow_metrics_log').find({}).sort({timestamp:-1}).limit(1).toArray();
    if(sh[0]){
      const sm = sh[0];
      L.push(fn('yellow','  ── SHADOW PRICING ───────────────────'));
      L.push('  Real:   ' + fn('green','1.000') + '   Shadow: ' + fn('cyan',(sm.shadowMultiplier||1).toFixed(3)));
      L.push('  Drift:  ' + fn(sm.conversionDrift>0.1?'red':sm.conversionDrift>0.05?'yellow':'green',(sm.conversionDrift||0).toFixed(3)) + '   ' + fn(sm.diagnosis==='SIGNAL'?'red':sm.diagnosis==='INDETERMINADO'?'yellow':'gray',sm.diagnosis||'—'));
      L.push('  Stress: ' + fn(sm.systemUnderStress?'red':'green',sm.systemUnderStress?'⚠ SI':'✓ NO'));
      L.push(sep);
    }
  } catch(_){}
  L.push(`  ${fn('yellow','ÚLTIMOS EVENTOS')}`);
  if (s.ultimos.length === 0) {
    L.push(fn('gray','  (sin eventos aún — hacé un pedido de prueba)'));
  } else {
    s.ultimos.forEach(e => {
      const t   = new Date(e.timestamp).toLocaleTimeString('es-AR');
      const et  = (e.entityType||'?').toUpperCase().padEnd(6);
      const tp  = (e.type||'?').padEnd(16);
      const agg = String(e.aggregateId||'').slice(-6);
      L.push(`  ${fn('gray',t)} ${fn('cyan',et)} ${fn('green',tp)} ${fn('gray','…'+agg)}`);
    });
  }

  L.push(sep);
  L.push(fn('gray', `  Refresh cada ${POLL_MS/1000}s — Ctrl+C para salir`));
  L.push('');

  // Limpiar y escribir de una sola vez
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H' + L.join('\n') + '\n');
}

async function loop() {
  try {
    render(await getSnapshot());
  } catch(e) {
    process.stdout.write('\x1b[2J\x1b[H' + fn('red','Error: ' + e.message) + '\n');
  }
  setTimeout(loop, POLL_MS);
}

async function main() {
  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(fn('cyan','[Nexus] Conectando a MongoDB...\n'));
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  process.stdout.write(fn('green','[Nexus] Conectado ✅\n\n'));
  await new Promise(r => setTimeout(r, 500));
  await loop();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
