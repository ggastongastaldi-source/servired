const fetch = require('node-fetch');
const PrecioMercado = require('../models/PrecioMercado');

const TAVILY_KEY = process.env.TAVILY_API_KEY;

const RUBROS_BUSQUEDA = {
  limpieza_hogar:          'precio hora empleada doméstica limpieza por hora CABA GBA abril 2026 pesos',
  servicio_domestico:      'precio hora servicio doméstico empleada cama adentro afuera Buenos Aires 2026',
  plomeria:                'precio hora plomero plomería urgencia CABA Buenos Aires 2026',
  electricidad:            'precio hora electricista electricidad domiciliaria CABA Buenos Aires 2026',
  gasista:                 'precio hora gasista matriculado instalación CABA Buenos Aires 2026',
  pintura:                 'precio metro cuadrado pintura interior exterior CABA Buenos Aires 2026',
  albanileria:             'precio mano obra albañil construccion refaccion CABA Buenos Aires abril 2026 pesos argentinos',
  cerrajeria:              'precio cerrajero urgencia apertura cerradura CABA Buenos Aires 2026',
  jardineria:              'precio hora jardinero jardinería mantenimiento Buenos Aires 2026',
  fletes_mudanzas:         'precio flete mudanza camión Buenos Aires GBA 2026',
  durlock:                 'precio metro cuadrado durlock instalación mano obra CABA 2026',
  pisos_revestimientos:    'precio metro cuadrado colocación pisos cerámicos CABA Buenos Aires 2026',
  techistas:               'precio metro cuadrado techista techo impermeabilización CABA 2026',
  herreria:                'precio hora herrero herrería rejas portón CABA Buenos Aires 2026',
  carpinteria:             'precio hora carpintero mueble a medida CABA Buenos Aires 2026',
  revestimientos_pvc:      'precio metro cuadrado cielorraso PVC colocación Buenos Aires 2026',
  antihumedad:             'precio tratamiento antihumedad humedad muro CABA Buenos Aires 2026',
  impermeabilizacion:      'precio impermeabilizacion techo losa terraza membrana liquida Buenos Aires 2026',
  climatizacion:           'precio instalación aire acondicionado split CABA Buenos Aires 2026',
  camaras_seguridad:       'precio instalación 4 cámaras seguridad CCTV DVR kit hogar Buenos Aires Argentina 2026 pesos',
  camaras_seguridad_ml:    'kit 4 camaras seguridad instalacion precio mercadolibre argentina 2026',
  alarmas:                 'precio instalación alarma perimetral hogar Buenos Aires 2026',
  domotica_automatizacion: 'precio instalación domótica automatización hogar Buenos Aires 2026',
  paneles_solares:         'precio kit paneles solares instalacion residencial 3kw 5kw Argentina abril 2026 pesos',
  mecanica_auxilio:        'precio auxilio mecánico ruta Buenos Aires GBA 2026',
  mantenimiento_consorcios:'precio mantenimiento consorcio edificio Buenos Aires 2026',
  peluqueria_canina:       'precio peluquería canina baño corte perro Buenos Aires 2026',
  fumigacion:              'precio fumigación control plagas cucarachas Buenos Aires abril 2026 pesos',
  // Materiales — MercadoLibre directo
  mat_ceramica:            'ceramica piso baño 45x45 caja precio mercadolibre argentina 2026',
  mat_porcelanato:         'porcelanato 60x60 piso precio caja mercadolibre argentina 2026',
  mat_camaras_kit:         'kit 4 camaras seguridad dvr disco duro precio mercadolibre argentina 2026',
  mat_alarma:              'kit alarma inalambrica domiciliaria precio mercadolibre argentina 2026',
  mat_split:               'aire acondicionado split 3000 frigorias precio mercadolibre argentina 2026',
  mat_paneles:             'panel solar 450w kit instalacion precio mercadolibre argentina 2026',
  mat_grifo:               'griferia baño monocomando precio mercadolibre argentina 2026',
  mat_inodoro:             'inodoro completo con mochila precio mercadolibre argentina 2026',
};

async function buscarPrecioRubro(rubro, query) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      })
    });
    const data = await res.json();
    const contexto = (data.results || []).map(r => r.content).join('\n').slice(0, 2000);
    return { rubro, contexto, answer: data.answer || '' };
  } catch(e) {
    console.error(`[preciosMarket] Error buscando ${rubro}:`, e.message);
    return null;
  }
}

async function interpretarConGroq(resultados) {
  const GROQ_KEY = process.env.GROQ_API_KEY;
  const prompt = `Sos un experto en precios de servicios del hogar en Argentina (Buenos Aires, abril 2026).
El dólar blue está aproximadamente en $1.350 ARS. El Big Mac vale $9.000 ARS.
La inflación acumulada 2025-2026 fue alta. Los precios que extraigas deben ser en ARS actuales, no desactualizados.
Para mano de obra: un electricista cobra $80.000-$300.000 por trabajo, una empleada doméstica $8.000-$18.000 por hora.
Con base en estos datos de búsqueda web, extraé rangos de precios realistas en ARS para mano de obra.
Respondé SOLO con JSON válido, sin texto extra, con este formato exacto:
{
  "rubro": { "baja": NUMBER, "alta": NUMBER },
  ...
}
Datos:
${resultados.map(r => `=== ${r.rubro} ===\n${r.answer}\n${r.contexto}`).join('\n\n').slice(0, 6000)}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    })
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content || '{}';
}

async function actualizarPreciosEnSmartQuote(precios) {
  // Guardar en MongoDB (sobrevive deploys)
  let actualizados = 0;
  for (const [rubro, vals] of Object.entries(precios)) {
    if (!vals.baja || !vals.alta) continue;
    try {
      await PrecioMercado.findOneAndUpdate(
        { rubro },
        { baja: Math.round(vals.baja), alta: Math.round(vals.alta), fuente: 'tavily', actualizadoEn: new Date() },
        { upsert: true, returnDocument: "after" }
      );
      actualizados++;
    } catch(e) { console.error('[preciosMarket] Error guardando', rubro, e.message); }
  }
  console.log(`[preciosMarket] ✅ ${actualizados} rubros actualizados en MongoDB`);
  return actualizados;
}
async function actualizarPreciosEnSmartQuote_FILE(precios) {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '../routes/smartQuote.js');
  let content = fs.readFileSync(filePath, 'utf8');

  let actualizados = 0;
  for (const [rubro, vals] of Object.entries(precios)) {
    if (!vals.baja || !vals.alta) continue;
    const baja = Math.round(vals.baja / 1000) * 1000;
    const alta = Math.round(vals.alta / 1000) * 1000;
    const regex = new RegExp(`(${rubro}:\\s*\\{\\s*baja:\\s*)\\d+([^}]*alta:\\s*)\\d+`, 'g');
    const newContent = content.replace(regex, `$1${baja}$2${alta}`);
    if (newContent !== content) { content = newContent; actualizados++; }
  }

  fs.writeFileSync(filePath, content);
  console.log(`[preciosMarket] ✅ ${actualizados} rubros actualizados en smartQuote.js`);
  return actualizados;
}

async function correrActualizacion() {
  console.log('[preciosMarket] 🔍 Iniciando búsqueda de precios reales...');
  const rubros = Object.entries(RUBROS_BUSQUEDA);
  const resultados = [];

  // Procesar en lotes de 5 para no saturar la API
  for (let i = 0; i < rubros.length; i += 5) {
    const lote = rubros.slice(i, i + 5);
    const res = await Promise.all(lote.map(([r, q]) => buscarPrecioRubro(r, q)));
    resultados.push(...res.filter(Boolean));
    if (i + 5 < rubros.length) await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[preciosMarket] 📊 ${resultados.length} rubros consultados, interpretando con Groq...`);
  const jsonStr = await interpretarConGroq(resultados);

  let precios = {};
  try {
    const clean = jsonStr.replace(/```json|```/g, '').trim();
    precios = JSON.parse(clean);
  } catch(e) {
    console.error('[preciosMarket] Error parseando JSON de Groq:', e.message);
    return;
  }

  const actualizados = await actualizarPreciosEnSmartQuote(precios);
  console.log(`[preciosMarket] 🎯 Actualización completa. ${actualizados} rubros con precios reales.`);
  return precios;
}

async function buscarPrecioML(rubro, query) {
  try {
    // Buscar en ML via Tavily (más confiable que scraping directo)
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: query + ' precio ARS',
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_domains: ['mercadolibre.com.ar', 'listado.mercadolibre.com.ar'],
      })
    });
    const data = await res.json();
    const contexto = (data.results || []).map(r => r.content).join('\n').slice(0, 1500);
    return { rubro, contexto, answer: data.answer || '', fuente: 'MercadoLibre' };
  } catch(e) {
    console.error(`[preciosMarket/ML] Error ${rubro}:`, e.message);
    return null;
  }
}

async function correrActualizacionMateriales() {
  console.log('[preciosMarket] 🛒 Buscando precios de materiales en MercadoLibre...');
  const matRubros = Object.entries(RUBROS_BUSQUEDA).filter(([k]) => k.startsWith('mat_'));
  const resultados = [];
  for (let i = 0; i < matRubros.length; i += 4) {
    const lote = matRubros.slice(i, i + 4);
    const res = await Promise.all(lote.map(([r, q]) => buscarPrecioML(r, q)));
    resultados.push(...res.filter(Boolean));
    if (i + 4 < matRubros.length) await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`[preciosMarket] 🛒 ${resultados.length} precios de materiales encontrados`);
  // Interpretar con Groq y guardar en MongoDB para referencia
  const jsonStr = await interpretarConGroq(resultados);
  try {
    const clean = jsonStr.replace(/```json|```/g, '').trim();
    const precios = JSON.parse(clean);
    console.log('[preciosMarket] 💾 Materiales ML:', JSON.stringify(precios, null, 2));
    return precios;
  } catch(e) {
    console.error('[preciosMarket] Error parseando materiales:', e.message);
  }
}

module.exports = { correrActualizacion, correrActualizacionMateriales };
