/**
 * ═══════════════════════════════════════════════════════
 *  FACTOR ALADÍN v1.0 — ServiRed 2026
 *  Sincroniza precios con la economía real argentina
 *  Anclas abril 2026: Big Mac $10.500 / Dólar Blue $1.450
 * ═══════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── ANCLAS BASE (abril 2026) ──
const ANCLA_BIGMAC  = 10500;
const ANCLA_DOLAR   = 1450;

// ── PRECIOS BASE por rubro (abril 2026) ──
const PRECIOS_BASE = {
  limpieza:           { baja: 35000,   alta: 75000   },
  servicio_domestico: { baja: 8500,    alta: 11000   },
  plomeria:           { baja: 180000,  alta: 480000  },
  electricidad:       { baja: 180000,  alta: 480000  },
  albanileria:        { baja: 250000,  alta: 750000  },
  pintura:            { baja: 220000,  alta: 650000  },
  gasista:            { baja: 220000,  alta: 650000  },
  cerrajeria:         { baja: 45000,   alta: 160000  },
  jardineria:         { baja: 55000,   alta: 180000  },
  mudanza:            { baja: 100000,  alta: 380000  },
  climatizacion:      { baja: 110000,  alta: 320000  },
  refrigeracion:      { baja: 80000,   alta: 250000  },
  durlock:            { baja: 180000,  alta: 500000  },
  antihumedad:        { baja: 150000,  alta: 450000  },
  revestimientos:     { baja: 220000,  alta: 650000  },
  carpinteria:        { baja: 180000,  alta: 550000  },
  herreria:           { baja: 180000,  alta: 500000  },
  techistas:          { baja: 250000,  alta: 750000  },
  fumigacion:         { baja: 55000,   alta: 150000  },
  peluqueria_canina:  { baja: 20000,   alta: 45000   },
  camaras:            { baja: 250000,  alta: 950000  },
  alarmas:            { baja: 220000,  alta: 850000  },
  domotica:           { baja: 400000,  alta: 1800000 },
  informatico:        { baja: 35000,   alta: 120000  },
  paneles_solares:    { baja: 500000,  alta: 1500000 },
  banio:              { baja: 800000,  alta: 2500000 },
  cocina:             { baja: 700000,  alta: 2200000 },
  reforma:            { baja: 1500000, alta: 5000000 },
  consorcios:         { baja: 110000,  alta: 320000  },
  mecanica:           { baja: 45000,   alta: 160000  },
};

// ── SCHEMA CONFIG (Factor Aladín en MongoDB) ──
const ConfigSchema = new mongoose.Schema({
  clave:        { type: String, required: true, unique: true },
  valor:        { type: Number },
  metadata:     { type: Object },
  actualizadoEn:{ type: Date, default: Date.now }
});
const Config = mongoose.model('Config', ConfigSchema);

const PrecioMercadoSchema = new mongoose.Schema({
  rubro:        { type: String, required: true, unique: true },
  baja:         { type: Number, required: true },
  alta:         { type: Number, required: true },
  fuente:       { type: String, default: 'aladdin-sync' },
  confidence:   { type: Number, default: 0.85 },
  unidad:       { type: String, default: 'hora' },
  actualizadoEn:{ type: Date, default: Date.now }
});
const PrecioMercado = mongoose.model('PrecioMercado', PrecioMercadoSchema);

// ── FETCH DÓLAR BLUE (Bluelytics) ──
async function getDolarBlue() {
  try {
    const res = await fetch('https://api.bluelytics.com.ar/v2/latest');
    const data = await res.json();
    const blue = data?.blue?.value_sell || data?.blue?.value_buy;
    if (blue && blue > 0) {
      console.log(`[Aladín] 💵 Dólar Blue: $${blue}`);
      return blue;
    }
  } catch(e) {
    console.warn('[Aladín] ⚠️ Bluelytics falló:', e.message);
  }

  // Fallback: dolarito.ar
  try {
    const res = await fetch('https://dolarito.ar/api/v1/informes/hoy');
    const data = await res.json();
    const blue = data?.blue?.venta || data?.blue?.compra;
    if (blue && blue > 0) {
      console.log(`[Aladín] 💵 Dólar Blue (fallback): $${blue}`);
      return blue;
    }
  } catch(e) {
    console.warn('[Aladín] ⚠️ Dolarito falló:', e.message);
  }

  console.warn('[Aladín] ⚠️ Usando dólar ancla $1.450');
  return ANCLA_DOLAR;
}

// ── FETCH BIG MAC (estimación por dólar) ──
async function getBigMac(dolarActual) {
  // Big Mac sigue al dólar blue con ratio ~7.2x histórico AMBA
  const estimado = Math.round(dolarActual * 7.2);
  console.log(`[Aladín] 🍔 Big Mac estimado: $${estimado}`);
  return estimado;
}

// ── CALCULAR FACTOR ALADÍN ──
function calcularFactor(dolarActual, bigMacActual) {
  const varDolar  = dolarActual  / ANCLA_DOLAR;
  const varBigMac = bigMacActual / ANCLA_BIGMAC;

  // Promedio ponderado: 70% BigMac (inflación real) + 30% Dólar
  const factor = (varBigMac * 0.7) + (varDolar * 0.3);

  console.log(`[Aladín] 📊 VarDólar: ${varDolar.toFixed(3)} | VarBigMac: ${varBigMac.toFixed(3)} | Factor: ${factor.toFixed(4)}`);
  return Math.round(factor * 10000) / 10000;
}

// ── ACTUALIZAR PRECIOS EN MONGODB ──
async function actualizarPrecios(factor) {
  let actualizados = 0;
  for (const [rubro, precios] of Object.entries(PRECIOS_BASE)) {
    const bajaActualizada = Math.round(precios.baja * factor);
    const altaActualizada = Math.round(precios.alta * factor);
    await PrecioMercado.findOneAndUpdate(
      { rubro },
      {
        rubro,
        baja: bajaActualizada,
        alta: altaActualizada,
        fuente: 'aladdin-sync',
        confidence: 0.85,
        actualizadoEn: new Date()
      },
      { upsert: true, new: true }
    );
    actualizados++;
  }
  console.log(`[Aladín] ✅ ${actualizados} rubros actualizados en MongoDB`);
}

// ── MAIN ──
async function main() {
  console.log('\n═══════════════════════════════════');
  console.log('  FACTOR ALADÍN — Sincronización');
  console.log(`  ${new Date().toLocaleString('es-AR')}`);
  console.log('═══════════════════════════════════\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Aladín] 🔌 MongoDB conectado');

  const dolarActual  = await getDolarBlue();
  const bigMacActual = await getBigMac(dolarActual);
  const factor       = calcularFactor(dolarActual, bigMacActual);

  // Guardar factor en colección Config
  await Config.findOneAndUpdate(
    { clave: 'factor_aladdin' },
    {
      clave: 'factor_aladdin',
      valor: factor,
      metadata: {
        dolar_blue: dolarActual,
        big_mac: bigMacActual,
        ancla_dolar: ANCLA_DOLAR,
        ancla_bigmac: ANCLA_BIGMAC,
        fecha: new Date().toISOString()
      },
      actualizadoEn: new Date()
    },
    { upsert: true, new: true }
  );

  await actualizarPrecios(factor);

  console.log(`\n[Aladín] 🚀 Factor guardado: ${factor}`);
  console.log('[Aladín] 🏁 Sincronización completa\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('[Aladín] ❌ Error fatal:', e.message);
  process.exit(1);
});
