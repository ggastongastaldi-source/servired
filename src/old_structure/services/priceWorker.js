'use strict';
const Groq = require('groq-sdk');
const PrecioMercado = require('../models/PrecioMercado');

const RUBROS = [
  'limpieza_hogar','servicio_domestico','plomeria','electricidad','gasista',
  'pintura','albanileria','cerrajeria','jardineria','fletes_mudanzas',
  'durlock','pisos_revestimientos','techistas','herreria','carpinteria',
  'revestimientos_pvc','antihumedad','climatizacion','camaras_seguridad',
  'alarmas','domotica_automatizacion','paneles_solares','mecanica_auxilio',
  'mantenimiento_consorcios','peluqueria_canina','fumigacion'
];

let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

async function consultarPreciosGroq() {
  const hoy = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const prompt = `Sos un experto en precios de servicios del hogar en Argentina (AMBA/Buenos Aires) a ${hoy}.
Dame una estimación realista en pesos argentinos de los siguientes rubros.
Para cada rubro devolve: precio mínimo (baja) y precio máximo (alta) por hora o unidad típica de cobro.

Rubros: ${RUBROS.join(', ')}

Respondé SOLO con un JSON válido, sin explicaciones, sin markdown, sin backticks.
Formato exacto:
{
  "plomeria": { "baja": 15000, "alta": 25000 },
  "electricidad": { "baja": 14000, "alta": 22000 }
}
Incluí los ${RUBROS.length} rubros.`;

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

  let actualizados = 0;
  for (const [rubro, vals] of Object.entries(precios)) {
    if (!vals.baja || !vals.alta) continue;
    await PrecioMercado.findOneAndUpdate(
      { rubro },
      {
        baja: vals.baja,
        alta: vals.alta,
        fuente: 'groq-estimacion',
        confidence: 0.75,
        actualizadoEn: new Date()
      },
      { upsert: true, new: true }
    );
    actualizados++;
  }
  console.log(`[Aladdín-Worker] ✅ ${actualizados} rubros actualizados en MongoDB.`);
  return actualizados;
}

module.exports = { ejecutarCicloAladin };
