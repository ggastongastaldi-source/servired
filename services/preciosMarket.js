const fetch = require('node-fetch');

const TAVILY_KEY = process.env.TAVILY_API_KEY;

const RUBROS_BUSQUEDA = {
  limpieza_hogar:          'precio hora limpieza doméstica empleada doméstica CABA Buenos Aires 2026',
  servicio_domestico:      'precio hora servicio doméstico empleada cama adentro afuera Buenos Aires 2026',
  plomeria:                'precio hora plomero plomería urgencia CABA Buenos Aires 2026',
  electricidad:            'precio hora electricista electricidad domiciliaria CABA Buenos Aires 2026',
  gasista:                 'precio hora gasista matriculado instalación CABA Buenos Aires 2026',
  pintura:                 'precio metro cuadrado pintura interior exterior CABA Buenos Aires 2026',
  albanileria:             'precio hora albañil albañilería construcción CABA Buenos Aires 2026',
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
  climatizacion:           'precio instalación aire acondicionado split CABA Buenos Aires 2026',
  camaras_seguridad:       'precio instalación cámaras seguridad CCTV hogar CABA Buenos Aires 2026',
  alarmas:                 'precio instalación alarma perimetral hogar Buenos Aires 2026',
  domotica_automatizacion: 'precio instalación domótica automatización hogar Buenos Aires 2026',
  paneles_solares:         'precio instalación paneles solares residencial Buenos Aires Argentina 2026',
  mecanica_auxilio:        'precio auxilio mecánico ruta Buenos Aires GBA 2026',
  mantenimiento_consorcios:'precio mantenimiento consorcio edificio Buenos Aires 2026',
  peluqueria_canina:       'precio peluquería canina baño corte perro Buenos Aires 2026',
  fumigacion:              'precio fumigación control plagas cucarachas Buenos Aires 2026',
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
  const prompt = `Sos un experto en precios de servicios del hogar en Argentina (Buenos Aires, 2026).
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
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    })
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content || '{}';
}

async function actualizarPreciosEnSmartQuote(precios) {
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

module.exports = { correrActualizacion };
