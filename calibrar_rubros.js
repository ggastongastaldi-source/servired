require('dotenv').config();
const mongoose = require('mongoose');

const PrecioMercadoSchema = new mongoose.Schema({
  rubro:        { type: String, required: true, unique: true },
  baja:         { type: Number, required: true },
  alta:         { type: Number, required: true },
  fuente:       { type: String, default: 'calibracion-mayo2026' },
  confidence:   { type: Number, default: 0.95 },
  unidad:       { type: String, default: 'visita' },
  horas_promedio: { type: Number, default: 2 },
  precio_max_alerta: { type: Number },
  actualizadoEn:{ type: Date, default: Date.now }
});
const PrecioMercado = mongoose.model('PrecioMercado', PrecioMercadoSchema);

// ══════════════════════════════════════════════════════
//  TABLA CALIBRADA — Mayo 2026 — Consenso 5 IAs + Calle
//  Dólar Blue $1.420 / Big Mac $10.224
//  Fuente: MercadoLibre, UOCRA, relevamiento AMBA
// ══════════════════════════════════════════════════════
const RUBROS_CALIBRADOS = [
  // ── POR VISITA ────────────────────────────────────
  { rubro: 'plomeria',          unidad: 'visita',  baja: 80000,   alta: 200000,  horas_promedio: 2 },
  { rubro: 'electricidad',      unidad: 'visita',  baja: 70000,   alta: 180000,  horas_promedio: 2 },
  { rubro: 'gasista',           unidad: 'visita',  baja: 70000,   alta: 180000,  horas_promedio: 2 },
  { rubro: 'cerrajeria',        unidad: 'visita',  baja: 25000,   alta: 80000,   horas_promedio: 1 },
  { rubro: 'cerrajero',         unidad: 'visita',  baja: 25000,   alta: 80000,   horas_promedio: 1 },
  { rubro: 'informatico',       unidad: 'visita',  baja: 20000,   alta: 70000,   horas_promedio: 2 },
  { rubro: 'fumigacion',        unidad: 'visita',  baja: 30000,   alta: 90000,   horas_promedio: 2 },
  { rubro: 'peluqueria_canina', unidad: 'visita',  baja: 8000,    alta: 25000,   horas_promedio: 1 },
  { rubro: 'refrigeracion',     unidad: 'visita',  baja: 60000,   alta: 180000,  horas_promedio: 2 },
  { rubro: 'climatizacion',     unidad: 'trabajo', baja: 80000,   alta: 250000,  horas_promedio: 3 },
  { rubro: 'mecanica',          unidad: 'visita',  baja: 30000,   alta: 120000,  horas_promedio: 2 },

  // ── POR HORA ──────────────────────────────────────
  { rubro: 'limpieza',          unidad: 'hora',    baja: 4500,    alta: 8500,    horas_promedio: 4 },
  { rubro: 'servicio_domestico',unidad: 'hora',    baja: 3500,    alta: 7000,    horas_promedio: 6 },
  { rubro: 'jardineria',        unidad: 'hora',    baja: 5000,    alta: 12000,   horas_promedio: 3 },
  { rubro: 'consorcios',        unidad: 'hora',    baja: 4000,    alta: 9000,    horas_promedio: 4 },

  // ── POR M² ───────────────────────────────────────
  { rubro: 'pintura',           unidad: 'm2',      baja: 3500,    alta: 9000,    horas_promedio: 6 },
  { rubro: 'albanileria',       unidad: 'm2',      baja: 5000,    alta: 16000,   horas_promedio: 8 },
  { rubro: 'albanil',           unidad: 'm2',      baja: 5000,    alta: 16000,   horas_promedio: 8 },
  { rubro: 'durlock',           unidad: 'm2',      baja: 4000,    alta: 12000,   horas_promedio: 5 },
  { rubro: 'antihumedad',       unidad: 'm2',      baja: 3500,    alta: 10000,   horas_promedio: 4 },
  { rubro: 'revestimientos',    unidad: 'm2',      baja: 4000,    alta: 14000,   horas_promedio: 5 },

  // ── POR TRABAJO ───────────────────────────────────
  { rubro: 'carpinteria',       unidad: 'trabajo', baja: 80000,   alta: 350000,  horas_promedio: 4 },
  { rubro: 'carpintero',        unidad: 'trabajo', baja: 80000,   alta: 350000,  horas_promedio: 4 },
  { rubro: 'herreria',          unidad: 'trabajo', baja: 90000,   alta: 380000,  horas_promedio: 5 },
  { rubro: 'herrero',           unidad: 'trabajo', baja: 90000,   alta: 380000,  horas_promedio: 5 },
  { rubro: 'techistas',         unidad: 'trabajo', baja: 120000,  alta: 450000,  horas_promedio: 6 },
  { rubro: 'techista',          unidad: 'trabajo', baja: 120000,  alta: 450000,  horas_promedio: 6 },
  { rubro: 'mudanza',           unidad: 'trabajo', baja: 250000,  alta: 800000,  horas_promedio: 5 },
  { rubro: 'camaras',           unidad: 'trabajo', baja: 150000,  alta: 500000,  horas_promedio: 4 },
  { rubro: 'alarmas',           unidad: 'trabajo', baja: 120000,  alta: 450000,  horas_promedio: 4 },
  { rubro: 'domotica',          unidad: 'trabajo', baja: 200000,  alta: 800000,  horas_promedio: 6 },
  { rubro: 'paneles_solares',   unidad: 'trabajo', baja: 400000,  alta: 1200000, horas_promedio: 8 },

  // ── OBRAS MAYORES ─────────────────────────────────
  { rubro: 'banio',             unidad: 'trabajo', baja: 850000,  alta: 2800000, horas_promedio: 45 },
  { rubro: 'cocina',            unidad: 'trabajo', baja: 750000,  alta: 2500000, horas_promedio: 40 },
  { rubro: 'reforma',           unidad: 'trabajo', baja: 1200000, alta: 4500000, horas_promedio: 80 },
];

async function calibrar() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n[Calibración] 🔌 MongoDB conectado');
  console.log('[Calibración] 🚀 Actualizando 30 rubros con precios reales de calle...\n');

  let ok = 0;
  for (const r of RUBROS_CALIBRADOS) {
    // precio_max_alerta = 3x el precio alto (filtro anti-absurdo)
    const precio_max_alerta = r.alta * 3;
    await PrecioMercado.findOneAndUpdate(
      { rubro: r.rubro },
      { ...r, precio_max_alerta, fuente: 'calibracion-mayo2026', confidence: 0.95, actualizadoEn: new Date() },
      { upsert: true }
    );
    const dolar = (r.alta / 1420).toFixed(0);
    console.log(`  ✅ ${r.rubro.padEnd(20)} | ${r.unidad.padEnd(8)} | $${r.baja.toLocaleString()} - $${r.alta.toLocaleString()} | ~USD ${dolar}`);
    ok++;
  }

  console.log(`\n[Calibración] ✅ ${ok} rubros calibrados`);
  console.log('[Calibración] 🏁 Precios reales de calle cargados en MongoDB\n');
  await mongoose.disconnect();
  process.exit(0);
}

calibrar().catch(e => {
  console.error('[Calibración] ❌ Error:', e.message);
  process.exit(1);
});
