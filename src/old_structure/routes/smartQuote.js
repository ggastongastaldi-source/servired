const express = require('express');
const PrecioMercado = require('../models/PrecioMercado');
const router = express.Router();
const Groq = require('groq-sdk');

// ── MICRO-CACHE 15 min ──
const _cache = new Map();
function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > 15 * 60 * 1000) { _cache.delete(key); return null; }
  return hit.val;
}
function cacheSet(key, val) { _cache.set(key, { val, ts: Date.now() }); }

// ── GROQ SINGLETON ──
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

// ── INDICES ECONÓMICOS ──
const INDICES = {
  bigMac: 10224,
  dolarBlue: 1420,
  inflacionUmbral: 0.15,
};

// ── MULTIPLICADORES DE ZONA (max +35% premium) ──
const MULT_ZONA = {
  puerto_madero:1.35, recoleta:1.25, palermo:1.20, belgrano:1.18,
  nunez:1.15, microcentro:1.18, san_isidro:1.15, vicente_lopez:1.15,
  olivos:1.12, colegiales:1.08, villa_urquiza:1.05, caballito:1.05,
  almagro:1.02, boedo:1.00, flores:0.98, san_telmo:1.00,
  tigre:0.95, pilar:0.93, escobar:0.90, zarate:0.88,
  lanus:0.88, avellaneda:0.88, quilmes:0.85, berazategui:0.83,
  florencio_varela:0.80, lomas_de_zamora:0.85, moron:0.87,
  merlo:0.83, moreno:0.79, la_matanza:0.81, marcos_paz:0.77,
  lujan:0.80, rosario:0.95, cordoba:0.92, mendoza:0.90,
  bariloche:1.15, neuquen:1.10, ushuaia:1.35, el_calafate:1.25,
  mar_del_plata:0.95, salta:0.88, tucuman:0.87,
  gba_oeste:0.83, gba_norte:0.95, gba_sur:0.85, amba:0.90,
};

// ── LEER PRECIO DESDE MONGODB ──
async function getPrecioRubro(rubro, complejidad) {
  try {
    const doc = await PrecioMercado.findOne({ rubro: rubro.toLowerCase() }).lean();
    if (doc) return doc;
  } catch(e) {
    console.error('[SmartQuote] DB error:', e.message);
  }
  // Fallback si no está en DB
  return { baja: 60000, alta: 150000, unidad: 'visita', horas_promedio: 2 };
}

// ── CALCULAR PRECIO FINAL ──
function calcularPrecio(doc, complejidad, zona, horas) {
  const nivel = (complejidad === 'alta' || complejidad === 'complejo') ? 'alta' : 'baja';
  const precioBase = nivel === 'alta' ? doc.alta : doc.baja;

  const zKey = Object.keys(MULT_ZONA).find(k => (zona||'').toLowerCase().includes(k));
  const multZona = zKey ? MULT_ZONA[zKey] : 1.0;

  let precioTotal;
  const unidad = doc.unidad || 'visita';

  if (unidad === 'hora') {
    const horasReales = Math.max(1, parseFloat(horas) || doc.horas_promedio || 2);
    precioTotal = Math.round(precioBase * multZona * horasReales);
  } else if (unidad === 'm2') {
    // m2: el cliente pasa horas como m2 o usamos 20m2 default
    const metros = Math.max(5, parseFloat(horas) || 20);
    precioTotal = Math.round(precioBase * multZona * metros);
  } else {
    // visita o trabajo: precio fijo, zona ajusta pero NO multiplica por horas
    precioTotal = Math.round(precioBase * multZona);
  }

  // ── FILTRO ANTI-ABSURDO ──
  const maxAlerta = doc.precio_max_alerta || (doc.alta * 3);
  const flagAbsurdo = precioTotal > maxAlerta;
  if (flagAbsurdo) {
    console.warn(`[SmartQuote] ⚠️ ALERTA: ${rubro} cotizó $${precioTotal} > max $${maxAlerta}. Clampeando.`);
    precioTotal = Math.round(doc.alta * multZona);
  }

  return { precioTotal, nivel, unidad, flagAbsurdo };
}

// ── POST / — Cotización principal ──
router.post('/', async (req, res) => {
  try {
    const { rubro, complejidad, zona, descripcion, texto, horas } = req.body;

    // Modo texto libre con Groq 70B
    if (texto && !rubro) {
      try {
        const groq = getGroq();
        const chat = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 500,
          messages: [{
            role: 'system',
            content: 'Sos Aladín, experto en mercado de oficios en Argentina mayo 2026. Dólar Blue $1.420, inflación acumulada alta. Cotizás en ARS mano de obra REAL de calle AMBA. Respondés SOLO JSON válido sin markdown.'
          },{
            role: 'user',
            content: `Cliente describió: "${texto}". Devolvé SOLO JSON: {"descripcion":"...","rubros":[{"nombre":"...","unidad":"visita|hora|m2|trabajo","precio_mano_obra":123456,"horas_estimadas":2,"justificacion":"..."}],"total_mano_obra":123456}`
          }]
        });
        const raw = chat.choices[0]?.message?.content?.trim() || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Sin JSON');
        const parsed = JSON.parse(match[0]);
        return res.json({ ok: true, modo: 'groq-70b', ...parsed });
      } catch(e) {
        console.error('[SmartQuote] Groq texto libre:', e.message.slice(0,80));
        return res.json({ ok: false, error: e.message });
      }
    }

    if (!rubro) return res.json({ ok: false, error: 'Falta rubro', total_estimado: 0 });

    // Cache check
    const cacheKey = `sq_${rubro}_${complejidad}_${zona}_${horas}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // Leer de MongoDB
    const doc = await getPrecioRubro(rubro, complejidad);
    const { precioTotal, nivel, unidad, flagAbsurdo } = calcularPrecio(doc, complejidad, zona, horas);

    const comision   = Math.round(precioTotal * 0.20);
    const manoObra   = Math.round(precioTotal * 0.65);
    const materiales = Math.round(precioTotal * 0.15);

    // Descripción IA con 8B (rápido)
    let descripcionIA = '';
    try {
      const groq = getGroq();
      const chat = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `SERVired mayo 2026. Servicio: ${rubro} en ${zona||'AMBA'}, nivel ${nivel}, precio $${precioTotal} ARS (${unidad}). Describí en 1 oración qué incluye. Solo texto.`
        }]
      });
      descripcionIA = chat.choices[0]?.message?.content?.trim() || '';
    } catch(e) {
      console.error('[SmartQuote] Groq desc:', e.message.slice(0,60));
    }

    const respuesta = {
      ok: true, modo: 'aladin-mongo',
      rubro, zona: zona||'AMBA',
      complejidad: nivel,
      unidad,
      horas_promedio: doc.horas_promedio || 2,
      estimado: precioTotal,
      total_estimado: precioTotal,
      mano_de_obra: manoObra,
      materiales,
      comision,
      precioCliente: precioTotal,
      pagoWorker: precioTotal - comision,
      pago_worker: precioTotal - comision,
      descripcion_ia: descripcionIA,
      dolar_blue: INDICES.dolarBlue,
      alerta_absurdo: flagAbsurdo || undefined,
    };
    cacheSet(cacheKey, respuesta);
    res.json(respuesta);

  } catch(e) {
    console.error('[SmartQuote] Error:', e.message);
    res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

// ── GET /watch/indices ──
router.get('/watch/indices', (req, res) => res.json(INDICES));

// ── GET /watch/precio ──
router.get('/watch/precio', async (req, res) => {
  const { r, z, h } = req.query;
  if (!r) return res.json({ e: 'falta r' });
  try {
    const doc = await PrecioMercado.findOne({ rubro: r.toLowerCase() }).lean();
    const base = doc?.baja || 60000;
    const unidad = doc?.unidad || 'visita';
    const zKey = Object.keys(MULT_ZONA).find(k => (z||'').toLowerCase().includes(k));
    const mult = zKey ? MULT_ZONA[zKey] : 1.0;
    const hrs = Math.max(1, parseFloat(h) || 1);
    const total = unidad === 'hora'
      ? Math.round(base * mult * hrs)
      : Math.round(base * mult);
    res.json({ r, total, unidad, worker: Math.round(total * 0.8), srv: Math.round(total * 0.2), f: doc ? 'mongo' : 'fallback' });
  } catch(e) {
    res.json({ e: e.message });
  }
});

// ── POST /watch/alerta-inflacion ──
router.post('/watch/alerta-inflacion', (req, res) => {
  const { umbral } = req.body;
  if (umbral && umbral > 0 && umbral < 1) {
    INDICES.inflacionUmbral = umbral;
    res.json({ ok: true, umbral });
  } else {
    res.json({ ok: false, error: 'umbral debe ser decimal entre 0 y 1' });
  }
});

module.exports = router;
