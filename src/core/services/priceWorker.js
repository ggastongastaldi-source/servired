'use strict';
const Groq = require('groq-sdk');
const PrecioMercado = require('../models/PrecioMercado');

// ADR-006 corolario: RUBROS derivado del catálogo canónico — no hardcodeado
const { getActivos } = require('../../../shared/catalogs/rubrosCatalog');
const RUBROS = getActivos()
  .filter(r => r.rolesPermitidos.includes('worker'))
  .map(r => r.id);

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

async function consultarPreciosGroq() {
  const prompt = `Sos un experto analista de precios de gremios y servicios del hogar en Argentina (AMBA/Gran Buenos Aires). Estamos en MAYO 2026. La inflación acumulada de los últimos 12 meses fue aproximadamente 45%. Los precios deben reflejar la realidad de la calle HOY.

Para cada rubro determiná la unidad de cobro lógica:
- "hora" para servicios de mano de obra por hora (plomería, electricidad, limpieza, etc.)
- "m2" para trabajos que se cobran por metro cuadrado (pintura, pisos, durlock, etc.)
- "trabajo" para instalaciones o trabajos que se cotizan como proyecto completo (paneles solares, aire acondicionado, impermeabilización, alarmas, cámaras, domótica)

Referencias orientativas mayo 2026:
- Servicio doméstico / limpieza del hogar entre $7.000 y $12.000 por hora (referencia: ~1 Big Mac = $8.500)
- Peluquería canina baño y corte perro chico entre $15.000 y $25.000 por trabajo
- Jardinería mantenimiento entre $8.000 y $15.000 por hora
- Un plomero en CABA cobra entre $18.000 y $35.000 por hora
- Un electricista entre $16.000 y $30.000 por hora
- Pintura interior entre $8.000 y $15.000 por m2
- Instalación de split 3000 frigorías entre $180.000 y $350.000 por trabajo
- Kit 4 cámaras instalado entre $200.000 y $500.000 por trabajo
- Paneles solares 3kw instalados entre $2.000.000 y $4.500.000 por trabajo

Rubros a cotizar: \${RUBROS.join(', ')}

CRÍTICO: Las keys del JSON deben ser EXACTAMENTE los nombres del array que te di, sin traducir ni renombrar. Respondé SOLO con un JSON válido, sin explicaciones, sin markdown, sin backticks.
Formato exacto — incluí los \${RUBROS.length} rubros:
{
  "plomeria": { "baja": 18000, "alta": 35000, "unidad": "hora" },
  "pintura": { "baja": 8000, "alta": 15000, "unidad": "m2" },
  "paneles_solares": { "baja": 2000000, "alta": 4500000, "unidad": "trabajo" }
}`;

  const resp = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 2000
  });

  const raw = resp.choices[0]?.message?.content || '{}';
  // Strip posibles backticks si Groq los manda igual
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function ejecutarCicloAladin() {
  console.log('[Aladdín-Worker] 🔍 Consultando precios de mercado vía Groq...');
  let precios;
  try {
    precios = await consultarPreciosGroq();
  } catch (err) {
    console.error('[Aladdín-Worker] ❌ Error Groq:', err.message);
    return;
  }

  if (!precios || Object.keys(precios).length === 0) {
    console.error('[Aladdín-Worker] ❌ Respuesta vacía.');
    return;
  }

  // ── PRECIOS FIJOS — Groq no puede pisar estos valores ──────
  const PRECIOS_FIJOS = {
    'servicio_domestico': { baja: 7000,  alta: 12000, unidad: 'hora' },
    'limpieza_hogar':     { baja: 7000,  alta: 12000, unidad: 'hora' },
    'jardineria':         { baja: 8000,  alta: 15000, unidad: 'hora' },
    'peluqueria_canina':  { baja: 15000, alta: 25000, unidad: 'trabajo' },
    'fletes_mudanzas':    { baja: 40000, alta: 90000, unidad: 'trabajo' },
  };
  // Inyectar fijos en el resultado de Groq
  for (const [r, v] of Object.entries(PRECIOS_FIJOS)) {
    precios[r] = v;
  }

  let actualizados = 0;
  for (const [rubro, vals] of Object.entries(precios)) {
    if (!vals.baja || !vals.alta) continue;
    // WHITELIST — ignorar cualquier rubro que Groq haya inventado
    // RRL: resolver alias legacy al id canónico antes del whitelist
    const { resolveRubro, UNKNOWN_RUBRO } = require('../../../shared/catalogs/rubrosCatalog');
    const rubroCanon = resolveRubro(rubro);
    if (rubroCanon !== UNKNOWN_RUBRO && rubroCanon !== rubro) {
      console.log(`[Aladdín-Worker] 🔄 Rubro resuelto: ${rubro} → ${rubroCanon}`);
    }
    const rubroFinal = rubroCanon !== UNKNOWN_RUBRO ? rubroCanon : rubro;
    if (!RUBROS.includes(rubroFinal)) {
      console.log(`[Aladdín-Worker] ⚠️  Rubro espurio ignorado: ${rubro}`);
      try {
        const mongoose = require('mongoose');
        const ode = require('../../services/ontologyDriftEngine');
        const rs = mongoose.connection.readyState;
        if (rs !== 1) {
          console.warn('[ODE-PW] Skip readyState:', rs, 'para rubro:', rubro);
        } else {
          ode.recordObservation(rubro, 'priceWorker', {})
            .then(() => console.log('[ODE-PW] ✅ observacion registrada:', rubro))
            .catch(e => console.error('[ODE-PW] ❌ error:', e.message));
        }
      } catch (e) {
        console.error('[ODE-PW] ❌ require error:', e.message);
      }
      continue;
    }
    await PrecioMercado.findOneAndUpdate(
      { rubro: rubroFinal },
      {
        baja: vals.baja,
        alta: vals.alta,
        unidad: vals.unidad || 'hora',
        fuente: 'groq-estimacion',
        confidence: 0.75,
        actualizadoEn: new Date()
      },
      { upsert: true, returnDocument: "after" }
    );
    actualizados++;
  }
  console.log(`[Aladdín-Worker] ✅ ${actualizados} rubros actualizados en MongoDB.`);
  return actualizados;
}

module.exports = { ejecutarCicloAladin };
