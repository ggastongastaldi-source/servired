const express = require('express');
const PrecioMercado = require('../models/PrecioMercado');
const router = express.Router();
const Groq = require('groq-sdk');

// ── MICRO-CACHE 15 min — evita llamadas repetidas a Groq/APIs ──
const _cache = new Map();
function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > 15 * 60 * 1000) { _cache.delete(key); return null; }
  return hit.val;
}
function cacheSet(key, val) { _cache.set(key, { val, ts: Date.now() }); }

// ── GROQ SINGLETON — una sola instancia en memoria ──
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ── INDICES ECONÓMICOS — valores con micro-cache ──
const INDICES = {
  bigMac: 10500,   // ARS abril 2026
  dolarBlue: 1450, // ARS abril 2026
  inflacionUmbral: 0.15, // 15% mensual dispara alerta háptica
};

// Precios reales abril 2026 indexados Big Mac $10.500
// Fuente: relevamiento AMBA + indice Big Mac
const PRECIOS = {
  limpieza:          { baja: 35000,   alta: 75000   },
  servicio_domestico:{ baja: 8500,    alta: 11000   }, // precio por hora ARS
  plomeria:          { baja: 180000,  alta: 480000  },
  electricidad:      { baja: 180000,  alta: 480000  },
  albanileria:       { baja: 250000,  alta: 750000  },
  pintura:           { baja: 220000,  alta: 650000  },
  gasista:           { baja: 220000,  alta: 650000  },
  cerrajeria:        { baja: 45000,   alta: 160000  },
  jardineria:        { baja: 55000,   alta: 180000  },
  mudanza:           { baja: 100000,  alta: 380000  },
  climatizacion:     { baja: 110000,  alta: 320000  },
  refrigeracion:     { baja: 80000,   alta: 250000  },
  durlock:           { baja: 180000,  alta: 500000  },
  antihumedad:       { baja: 150000,  alta: 450000  },
  revestimientos:    { baja: 220000,  alta: 650000  },
  carpinteria:       { baja: 180000,  alta: 550000  },
  herreria:          { baja: 180000,  alta: 500000  },
  techistas:         { baja: 250000,  alta: 750000  },
  fumigacion:        { baja: 55000,   alta: 150000  },
  peluqueria_canina: { baja: 20000,   alta: 45000   },
  camaras:           { baja: 250000,  alta: 950000  },
  alarmas:           { baja: 220000,  alta: 850000  },
  domotica:          { baja: 400000,  alta: 1800000 },
  informatico:       { baja: 35000,   alta: 120000  },
  paneles_solares:   { baja: 500000,  alta: 1500000 },
  banio:             { baja: 800000,  alta: 2500000 },
  cocina:            { baja: 700000,  alta: 2200000 },
  reforma:           { baja: 1500000, alta: 5000000 },
  consorcios:        { baja: 110000,  alta: 320000  },
  mecanica:          { baja: 45000,   alta: 160000  },
  // alias
  carpintero:        { baja: 180000,  alta: 550000  },
  cerrajero:         { baja: 45000,   alta: 160000  },
  albanil:           { baja: 250000,  alta: 750000  },
  techista:          { baja: 250000,  alta: 750000  },
  herrero:           { baja: 180000,  alta: 500000  },
};

const MULT_ZONA = {
  // ── CABA PREMIUM ─────────────────────────────
  recoleta:1.10, palermo:1.05, belgrano:1.05, nunez:1.02,
  microcentro:1.08, san_telmo:1.00, puerto_madero:1.20,
  colegiales:1.00, villa_urquiza:0.95, caballito:0.95,
  almagro:0.93, flores:0.90, boedo:0.90,

  // ── GBA NORTE ────────────────────────────────
  san_isidro:1.00, vicente_lopez:1.00, olivos:1.00,
  tigre:0.90, pilar:0.88, escobar:0.85, zarate:0.83,

  // ── GBA SUR ──────────────────────────────────
  lanus:0.83, avellaneda:0.83, quilmes:0.80,
  berazategui:0.78, florencio_varela:0.75, lomas_de_zamora:0.80,

  // ── GBA OESTE ────────────────────────────────
  moron:0.82, merlo:0.78, moreno:0.74, la_matanza:0.76,
  marcos_paz:0.72, lujan:0.75,

  // ── GRAN ROSARIO ─────────────────────────────
  rosario:0.95, villa_gobernador_galvez:0.82, funes:0.90,
  fisherton:0.92, quilmes_rosario:0.80,

  // ── GRAN CORDOBA ─────────────────────────────
  cordoba:0.92, rio_cuarto:0.85, villa_maria:0.82,
  alta_gracia:0.85, jesus_maria:0.80,

  // ── GRAN MENDOZA ─────────────────────────────
  mendoza:0.90, godoy_cruz:0.88, maipu:0.83,
  lujan_de_cuyo:0.88, san_rafael:0.80,

  // ── COSTA ATLANTICA ──────────────────────────
  mar_del_plata:0.95, pinamar:1.05, villa_gesell:1.00,
  miramar:0.88, necochea:0.85, monte_hermoso:0.88,
  san_clemente:0.90, santa_teresita:0.90, mar_de_ajo:0.88,

  // ── PATAGONIA (zona oil + turismo = premium) ──
  bariloche:1.10, neuquen:1.05, comodoro_rivadavia:1.10,
  rio_gallegos:1.08, ushuaia:1.25, el_calafate:1.20,
  viedma:0.92, zapala:0.88, cutral_co:0.95,

  // ── NOA ──────────────────────────────────────
  salta:0.88, jujuy:0.85, san_miguel_de_tucuman:0.87,
  tucuman:0.87, catamarca:0.80, la_rioja:0.78,

  // ── NEA ──────────────────────────────────────
  corrientes:0.82, resistencia:0.80, posadas:0.82,
  formosa:0.75, paso_de_los_libres:0.75,

  // ── CUYO ─────────────────────────────────────
  san_juan:0.83, san_luis:0.80, villa_mercedes:0.78,

  // ── PAMPEANA ─────────────────────────────────
  la_plata:0.88, bahia_blanca:0.88, mar_del_plata:0.95,
  santa_rosa:0.82, tandil:0.85, olavarria:0.80,
  junin:0.80, pehuajo:0.75, trenque_lauquen:0.75,

  // ── ENTRE RIOS / LITORAL ─────────────────────
  parana:0.83, concordia:0.80, gualeguaychu:0.82,
  santa_fe:0.88, rafaela:0.82, venado_tuerto:0.80,

  // ── FALLBACK GBA_OESTE (default sistema) ─────
  gba_oeste:0.78, gba_norte:0.92, gba_sur:0.80,
  amba:0.85, interior:0.80,
};

router.post('/', async (req, res) => {
  try {
    const { rubro, complejidad, zona, descripcion, texto, horas } = req.body;

    // Modo texto libre con Groq
    if (texto && !rubro) {
      try {
        const groq = getGroq();
        const chat = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Sos el motor Aladin de SERVired. Cliente describio: "${texto}". Abril 2026, Big Mac ARS 10500, dolar blue $1450. Identificar rubros y dar precios REALISTAS en ARS mano de obra CABA/GBA. Responde SOLO JSON: {"descripcion":"...","rubros":[{"nombre":"...","precio_mano_obra":123456,"descripcion":"..."}],"total_mano_obra":123456}`
          }]
        });
        const raw = chat.choices[0]?.message?.content?.trim() || '';
        const match = raw.match(/{[\s\S]*}/); if(match === null) throw new Error('Sin JSON'); const parsed = JSON.parse(match[0]);
        return res.json({ ok: true, modo: 'groq', ...parsed });
      } catch(e) {
        console.error('[smartQuote] Groq texto:', e.message.slice(0,60));
        return res.json({ ok: false, error: e.message });
      }
    }

    if (!rubro) return res.json({ ok: false, error: 'Falta rubro', total_estimado: 0 });

    // ── MICRO-CACHE: misma cotización en 15 min sin llamar Groq ──
    const cacheKey = `sq_${rubro}_${complejidad}_${zona}_${horas}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const nivel = (complejidad === 'alta' || complejidad === 'complejo') ? 'alta' : 'baja';
    const precioBase = PRECIOS[rubro]?.[nivel] || 80000;

    const zKey = Object.keys(MULT_ZONA).find(k => (zona||'').toLowerCase().includes(k));
    const multZona = zKey ? MULT_ZONA[zKey] : 1.0;

    const horasReales = Math.max(1, parseFloat(horas) || 1);
    const precioTotal = Math.round(precioBase * multZona * horasReales);
    const comision = Math.round(precioTotal * 0.20);
    const manoObra = Math.round(precioTotal * 0.65);
    const materiales = Math.round(precioTotal * 0.15);

    // Descripcion IA
    let descripcionIA = '';
    try {
      const groq = getGroq();
      const chat = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `SERVired abril 2026. Servicio: ${rubro} en ${zona||'CABA'}, nivel ${nivel}. Precio $${precioTotal} ARS. Describe en 1 oracion que incluye. Solo texto.`
        }]
      });
      descripcionIA = chat.choices[0]?.message?.content?.trim() || '';
    } catch(e) {
      console.error('[smartQuote] Groq IA:', e.message.slice(0,60));
    }

    const respuesta = {
      ok: true, modo: 'aladin',
      rubro, zona: zona||'CABA',
      complejidad: nivel,
      estimado: precioTotal,
      total_estimado: precioTotal,
      mano_de_obra: manoObra,
      materiales: materiales,
      comision: comision,
      precioCliente: precioTotal,
      pagoWorker: precioTotal - comision,
      pago_worker: precioTotal - comision,
      descripcion_ia: descripcionIA,
      big_mac_base: INDICES.bigMac,
    };
    cacheSet(cacheKey, respuesta);
    res.json(respuesta);

  } catch(e) {
    console.error('[smartQuote] Error:', e.message);
    res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

module.exports = router;
// cache-bust Tue Apr 28 01:05:54 -03 2026
// bust-1777349554

// ── SMARTWATCH API — endpoints minimalistas ──────────────────
// GET /api/smart-quote/watch/indices
// Devuelve BigMac + dólar + umbral inflación (JSON < 100 bytes)
router.get('/watch/indices', (req, res) => {
  res.json(INDICES);
});

// GET /api/smart-quote/watch/precio?r=plomeria&z=palermo
// Cotización ultra-rápida sin IA, solo tabla local
router.get('/watch/precio', (req, res) => {
  const { r, z, h } = req.query;
  if (!r) return res.json({ e: 'falta r' });
  const base = PRECIOS[r]?.baja || 80000;
  const zKey = Object.keys(MULT_ZONA).find(k => (z||'').toLowerCase().includes(k));
  const mult = zKey ? MULT_ZONA[zKey] : 1.0;
  const hrs = Math.max(1, parseFloat(h) || 1);
  const total = Math.round(base * mult * hrs);
  // Respuesta minimalista para pantalla chica
  res.json({ r, total, worker: Math.round(total * 0.8), srv: Math.round(total * 0.2) });
});

// POST /api/smart-quote/watch/alerta-inflacion
// El watch puede configurar el umbral háptico
router.post('/watch/alerta-inflacion', (req, res) => {
  const { umbral } = req.body;
  if (umbral && umbral > 0 && umbral < 1) {
    INDICES.inflacionUmbral = umbral;
    res.json({ ok: true, umbral });
  } else {
    res.json({ ok: false, error: 'umbral debe ser decimal entre 0 y 1' });
  }
});
