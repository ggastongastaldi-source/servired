// Nexus Monitor v1.0 — Termux / ANSI simple / bajo consumo
// polling adaptativo: 5s activo, 30s background
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const POLL_MS   = 5000;
const MAX_EVENTS = 15;

// ANSI helpers
const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m',
  clear:  '\x1b[2J\x1b[H'
};

function color(c, txt) { return `${C[c]}${txt}${C.reset}`; }

async function getSnapshot() {
  const now   = new Date();
  const min1  = new Date(now - 60000);
  const min5  = new Date(now - 300000);

  const [
    totalEventos,
    eventosMin1,
    eventosMin5,
    ultimosEventos,
    jobs,
    leads,
    zonas
  ] = await Promise.all([
    mongoose.connection.collection('events').countDocuments(),
    mongoose.connection.collection('events').countDocuments({ timestamp: { $gte: min1 } }),
    mongoose.connection.collection('events').countDocuments({ timestamp: { $gte: min5 } }),
    mongoose.connection.collection('events')
      .find({}).sort({ timestamp: -1 }).limit(MAX_EVENTS).toArray(),
    mongoose.connection.collection('proj_jobs').countDocuments(),
    mongoose.connection.collection('proj_leads').countDocuments(),
    mongoose.connection.collection('proj_zona_metrics')
      .find({}).sort({ completados: -1 }).limit(5).toArray()
  ]);

  return { totalEventos, eventosMin1, eventosMin5, ultimosEventos, jobs, leads, zonas };
}

function render(snap) {
  const { totalEventos, eventosMin1, eventosMin5, ultimosEventos, jobs, leads, zonas } = snap;
  const lines = [];
  const now = new Date().toLocaleTimeString('es-AR');

  lines.push(C.clear);
  lines.push(color('bold', color('cyan', '╔══════════════════════════════════╗')));
  lines.push(color('bold', color('cyan', '║    NEXUS MONITOR v1.0 — ServiRed  ║')));
  lines.push(color('bold', color('cyan', '╚══════════════════════════════════╝')));
  lines.push('');
  lines.push(`  ${color('gray','Hora:')}  ${color('green', now)}   ${color('gray','Status:')} ${color('green','● LIVE')}`);
  lines.push('');
  lines.push(color('yellow','  ── EVENTOS ─────────────────────────'));
  lines.push(`  Total:        ${color('cyan', String(totalEventos))}`);
  lines.push(`  Último min:   ${color('green', String(eventosMin1))} eventos/min`);
  lines.push(`  Últimos 5min: ${color('green', String(eventosMin5))} eventos`);
  lines.push('');
  lines.push(color('yellow','  ── PROJECTIONS ──────────────────────'));
  lines.push(`  Jobs:   ${color('cyan', String(jobs))}   Leads: ${color('cyan', String(leads))}`);
  lines.push('');

  if (zonas.length) {
    lines.push(color('yellow','  ── TOP ZONAS ────────────────────────'));
    zonas.forEach(z => {
      lines.push(`  ${color('green', (z.zona||'?').padEnd(15))} ${z.rubro||'?'} — ${color('cyan', String(z.completados||0))} jobs`);
    });
    lines.push('');
  }

  lines.push(color('yellow','  ── ÚLTIMOS EVENTOS ──────────────────'));
  ultimosEventos.forEach(e => {
    const t  = new Date(e.timestamp).toLocaleTimeString('es-AR');
    const et = (e.entityType||'?').padEnd(6);
    const tp = (e.type||'?').padEnd(18);
    const agg = String(e.aggregateId||'').slice(-6);
    lines.push(`  ${color('gray',t)}  ${color('cyan',et)} ${color('green',tp)} ${color('gray','…'+agg)}`);
  });

  lines.push('');
  lines.push(color('gray', `  Próximo refresh en ${POLL_MS/1000}s — Ctrl+C para salir`));

  process.stdout.write(lines.join('\n') + '\n');
}

async function loop() {
  try {
    const snap = await getSnapshot();
    render(snap);
  } catch(e) {
    process.stdout.write(C.clear + color('red', '[Monitor] Error: ' + e.message) + '\n');
  }
  setTimeout(loop, POLL_MS);
}

async function main() {
  process.stdout.write(C.clear + color('cyan', '[Nexus Monitor] Conectando a MongoDB...\n'));
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(color('green', '[Nexus Monitor] Conectado ✅'));
  await loop();
}

main().catch(e => {
  console.error('[Monitor] Fatal:', e.message);
  process.exit(1);
});
