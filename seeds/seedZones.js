// seeds/seedZones.js — Inicializa ZoneState con zonas del AMBA
// Uso: node seeds/seedZones.js
require('dotenv').config();
const mongoose = require('mongoose');
const ZoneState = require('../models/ZoneState');

const ZONAS_AMBA = [
  { zoneId: 'la_matanza',      demand: 0.75, supply: 0.40, amplification: 1.8 },
  { zoneId: 'lomas_de_zamora', demand: 0.60, supply: 0.45, amplification: 1.5 },
  { zoneId: 'quilmes',         demand: 0.55, supply: 0.50, amplification: 1.4 },
  { zoneId: 'moron',           demand: 0.65, supply: 0.35, amplification: 1.7 },
  { zoneId: 'lanus',           demand: 0.50, supply: 0.55, amplification: 1.3 },
  { zoneId: 'merlo',           demand: 0.70, supply: 0.30, amplification: 1.9 },
  { zoneId: 'pilar',           demand: 0.45, supply: 0.60, amplification: 1.2 },
  { zoneId: 'tigre',           demand: 0.40, supply: 0.65, amplification: 1.1 },
  { zoneId: 'san_justo',       demand: 0.80, supply: 0.25, amplification: 2.0 },
  { zoneId: 'flores',          demand: 0.55, supply: 0.52, amplification: 1.3 },
  { zoneId: 'palermo',         demand: 0.35, supply: 0.70, amplification: 1.0 },
  { zoneId: 'belgrano',        demand: 0.30, supply: 0.75, amplification: 1.0 },
  { zoneId: 'avellaneda',      demand: 0.62, supply: 0.42, amplification: 1.6 },
  { zoneId: 'san_isidro',      demand: 0.38, supply: 0.68, amplification: 1.1 },
  { zoneId: 'hurlingham',      demand: 0.68, supply: 0.33, amplification: 1.8 },
  { zoneId: 'ezeiza',          demand: 0.72, supply: 0.28, amplification: 1.9 },
  { zoneId: 'ituzaingo',       demand: 0.58, supply: 0.48, amplification: 1.4 },
  { zoneId: 'berazategui',     demand: 0.64, supply: 0.38, amplification: 1.6 },
  { zoneId: 'florencio_varela',demand: 0.78, supply: 0.22, amplification: 2.1 },
  { zoneId: 'almirante_brown', demand: 0.66, supply: 0.36, amplification: 1.7 },
];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function computePressure(d, s, a) { return clamp((d * a) - s, -1, 1); }
function deriveState(p) {
  if (p > 0.2)  return 'SHORTAGE';
  if (p < -0.2) return 'SURPLUS';
  return 'BALANCED';
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Seed] MongoDB conectado');

  let created = 0, updated = 0;

  for (const z of ZONAS_AMBA) {
    const pressure = computePressure(z.demand, z.supply, z.amplification);
    const state    = deriveState(pressure);
    const pricingMultiplier = parseFloat((1 + pressure * 0.5).toFixed(2));

    const existing = await ZoneState.findOne({ zoneId: z.zoneId });
    if (existing) {
      console.log(`[Seed] SKIP ${z.zoneId} — ya existe (${existing.zoneState})`);
      updated++;
      continue;
    }

    await ZoneState.create({
      zoneId:           z.zoneId,
      demand:           z.demand,
      supply:           z.supply,
      amplification:    z.amplification,
      marketPressure:   pressure,
      zoneState:        state,
      pricingMultiplier,
      eventCount:       0,
      lastUpdated:      new Date(),
    });

    console.log(`[Seed] ✅ ${z.zoneId} → ${state} (presión: ${(pressure*100).toFixed(0)}%)`);
    created++;
  }

  console.log(`\n[Seed] Completo — ${created} creadas, ${updated} existentes`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error('[Seed] ERROR:', e.message); process.exit(1); });
