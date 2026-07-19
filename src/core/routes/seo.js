/**
 * seo.js — AEO (Answer Engine Optimization)
 * Rutas /servicio/:oficio/:localidad con JSON-LD Schema.org
 * Para indexación por LLMs: ChatGPT, Perplexity, Claude, etc.
 */
'use strict';

const express = require('express');
const { trackEvent } = require('../../core/services/trackEvent');
const { LOCALIDADES } = require('../../core/config/territoryMap');
const { enrichSEOEvent } = require('../../core/services/seoEventEnricher');
const router  = express.Router();

const RUBROS = {
  // Servicios del hogar
  electricista:           { label: 'Electricista',                categoria: 'Servicios Eléctricos' },
  plomero:                { label: 'Plomero',                     categoria: 'Servicios de Plomería' },
  gasista:                { label: 'Gasista Matriculado',         categoria: 'Servicios de Gas' },
  pintor:                 { label: 'Pintor',                      categoria: 'Servicios de Pintura' },
  albanil:                { label: 'Albañil',                     categoria: 'Construcción y Reformas' },
  carpintero:             { label: 'Carpintero',                  categoria: 'Carpintería' },
  cerrajero:              { label: 'Cerrajero',                   categoria: 'Cerrajería' },
  limpieza_hogar:         { label: 'Limpieza del Hogar',          categoria: 'Limpieza' },
  servicio_domestico:     { label: 'Servicio Doméstico',          categoria: 'Servicio Doméstico' },
  aire_acondicionado:     { label: 'Técnico en Aire Acondicionado', categoria: 'Climatización' },
  fletes:                 { label: 'Flete y Mudanzas',            categoria: 'Mudanzas y Fletes' },
  jardinero:              { label: 'Jardinero',                   categoria: 'Jardinería' },
  // Tecnología y seguridad
  camaras_seguridad:      { label: 'Instalación de Cámaras de Seguridad', categoria: 'Seguridad' },
  paneles_solares:        { label: 'Instalación de Paneles Solares',       categoria: 'Energía Solar' },
  redes_wifi:             { label: 'Instalación de Redes y WiFi',          categoria: 'Tecnología' },
  alarmas:                { label: 'Instalación de Alarmas',               categoria: 'Seguridad' },
  porteros_electricos:    { label: 'Porteros Eléctricos y Video Porteros', categoria: 'Seguridad' },
  tecnico_pc:             { label: 'Técnico en Computadoras',              categoria: 'Tecnología' },
  // Construcción y obra
  impermeabilizacion:     { label: 'Impermeabilización de Terrazas',       categoria: 'Construcción' },
  durlock:                { label: 'Construcción en Durlock',              categoria: 'Construcción en Seco' },
  pisos_revestimientos:   { label: 'Colocación de Pisos y Revestimientos', categoria: 'Construcción' },
  techista:               { label: 'Techista',                            categoria: 'Construcción' },
  soldador:               { label: 'Soldador',                            categoria: 'Metalúrgica' },
  herreria:               { label: 'Herrero',                             categoria: 'Herrería' },
  // PyMEs y comercios
  servicio_pyme:          { label: 'Servicios para PyMEs',                categoria: 'Empresas' },
  servicio_comercio:      { label: 'Servicios para Comercios',            categoria: 'Comercios' },
  mantenimiento_edilicio: { label: 'Mantenimiento Edilicio',              categoria: 'Empresas' },
  limpieza_comercial:     { label: 'Limpieza Comercial e Industrial',     categoria: 'Limpieza' },
  // Fabricantes y distribuidores
  fabricante_muebles:     { label: 'Fabricantes de Muebles',             categoria: 'Fabricantes' },
  fabricante_aberturas:   { label: 'Fabricantes de Aberturas',           categoria: 'Fabricantes' },
  distribuidor_materiales:{ label: 'Distribuidores de Materiales',       categoria: 'Mayoristas' },
  corralon:               { label: 'Corralón de Materiales',             categoria: 'Mayoristas' },
};

// LOCALIDADES — derivado de territoryMap.js (fuente única de verdad)

function buildJsonLd(rubro, localidad, meta, zona) {
  const url = `https://servired.online/servicio/${rubro}/${localidad}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        "name": `${meta.label} en ${zona}`,
        "description": `Encontrá ${meta.label.toLowerCase()}s verificados en ${zona} a través de ServiRed. Precios transparentes, solicitud inmediata.`,
        "serviceType": meta.categoria,
        "areaServed": {
          "@type": "City",
          "name": zona,
          "containedInPlace": { "@type": "State", "name": "Buenos Aires", "containedInPlace": { "@type": "Country", "name": "Argentina" } }
        },
        "provider": {
          "@type": "LocalBusiness",
          "@id": "https://servired.online#organization",
          "name": "ServiRed",
          "url": "https://servired.online",
          "description": "ServiRed es la infraestructura digital territorial que organiza la economía real del AMBA, conectando comercios, trabajadores verificados, PyMEs y fabricantes con demanda real.",
          "areaServed": { "@type": "AdministrativeArea", "name": "AMBA - Área Metropolitana de Buenos Aires", "containedInPlace": { "@type": "Country", "name": "Argentina" } }, "knowsAbout": ["servicios profesionales", "comercios locales", "PyMEs argentinas", "fabricantes argentinos", "mantenimiento edilicio", "economía territorial", "infraestructura económica digital"]
        },
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "priceCurrency": "ARS",
          "description": `Precio dinámico según demanda en ${zona}.`
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": `¿Cómo consigo un ${meta.label.toLowerCase()} en ${zona}?`,
            "acceptedAnswer": { "@type": "Answer", "text": `En ServiRed podés solicitar un ${meta.label.toLowerCase()} en ${zona} en minutos. El sistema asigna el trabajador disponible más cercano con mejor puntaje.` }
          },
          {
            "@type": "Question",
            "name": `¿Cuánto cobra un ${meta.label.toLowerCase()} en ${zona}?`,
            "acceptedAnswer": { "@type": "Answer", "text": `El precio varía según el trabajo. ServiRed muestra un rango estimado antes de confirmar, actualizado con el índice de mercado local.` }
          },
          {
            "@type": "Question",
            "name": `¿Los trabajadores de ServiRed están verificados?`,
            "acceptedAnswer": { "@type": "Answer", "text": `Sí. Todos pasan por verificación de identidad y antecedentes antes de operar en la plataforma.` }
          }
        ]
      },
      {
        "@type": "Organization",
        "@id": "https://servired.online#organization",
        "name": "ServiRed",
        "url": "https://servired.online",
        "description": "Infraestructura digital territorial que conecta la econom\u00eda real argentina: comercios, trabajadores verificados, PyMEs, fabricantes y distribuidores del AMBA.",
        "knowsAbout": ["servicios profesionales", "comercios locales", "PyMEs argentinas", "fabricantes argentinos", "mantenimiento edilicio", "econom\u00eda territorial"],
        "areaServed": { "@type": "AdministrativeArea", "name": "AMBA" }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Inicio",    "item": "https://servired.online" },
          { "@type": "ListItem", "position": 2, "name": meta.label,  "item": `https://servired.online/servicio/${rubro}` },
          { "@type": "ListItem", "position": 3, "name": zona,        "item": url }
        ]
      }
    ]
  };
}

function buildHtml(rubro, localidad, meta, zona, jsonLd) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${meta.label} en ${zona} — ServiRed</title>
  <meta name="description" content="Encontrá ${meta.label.toLowerCase()}s verificados en ${zona}. Solicitud inmediata, precios transparentes.">
  <link rel="canonical" href="https://servired.online/servicio/${rubro}/${localidad}">
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;max-width:760px;margin:0 auto;padding:2rem 1rem;color:#1a1a1a}
    nav{font-size:.85rem;color:#666;margin-bottom:1.5rem}
    nav a{color:#e63946;text-decoration:none}
    h1{font-size:1.8rem;margin-bottom:.75rem}
    p{line-height:1.6;color:#444;margin-bottom:1rem}
    .cta{display:inline-block;margin:1rem 0 2rem;padding:.75rem 1.5rem;background:#e63946;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem}
    .faq{border-top:2px solid #f0f0f0;padding-top:1.5rem}
    .faq h2{margin-bottom:1rem;font-size:1.2rem}
    details{border:1px solid #e8e8e8;border-radius:8px;margin:.5rem 0;padding:.75rem 1rem}
    summary{font-weight:600;cursor:pointer;list-style:none}
    details p{margin-top:.5rem;font-size:.95rem;color:#555}
  </style>
</head>
<body>
  <nav><a href="/">ServiRed</a> › <a href="/servicio/${rubro}">${meta.label}</a> › ${zona}</nav>
  <h1>${meta.label} en ${zona} | Profesionales verificados ServiRed</h1>
  <p>ServiRed conecta hogares, comercios y edificios de ${zona} con profesionales verificados para ${meta.label.toLowerCase()}. Parte de la red económica inteligente del AMBA.</p>
  <a class="cta" href="/?rubro=${rubro}&zona=${localidad}">Solicitar ${meta.label} ahora</a>
  <h2>Servicios para hogares y comercios de ${zona}</h2>
  <p>Además de ${meta.label.toLowerCase()}, la red ServiRed en ${zona} cubre más de 30 rubros: electricidad, plomería, seguridad electrónica, impermeabilización, climatización y servicios para comercios y edificios.</p>
  <h2>Profesionales verificados en la red ServiRed</h2>
  <p>Todos los profesionales de ServiRed pasan por verificación de identidad. El sistema asigna el más cercano con mejor calificación en tiempo real.</p>
  <h2>Comercios, PyMEs y fabricantes conectados</h2>
  <p>ServiRed no es solo un servicio de oficios. Es la infraestructura que conecta toda la cadena económica local: fabricantes → distribuidores → comercios → profesionales → clientes. <a href="/red-economica-amba">Conocer la red completa</a>.</p>
  <section class="faq">
    <h2>Preguntas frecuentes</h2>
    <details><summary>¿Cómo consigo un ${meta.label.toLowerCase()} en ${zona}?</summary><p>En ServiRed podés solicitar un ${meta.label.toLowerCase()} en ${zona} en minutos. El sistema asigna el trabajador disponible más cercano con mejor puntaje.</p></details>
    <details><summary>¿Cuánto cobra un ${meta.label.toLowerCase()} en ${zona}?</summary><p>El precio varía según el trabajo. ServiRed muestra un rango estimado antes de confirmar, actualizado con el índice de mercado local.</p></details>
    <details><summary>¿Los trabajadores están verificados?</summary><p>Sí. Todos pasan por verificación de identidad y antecedentes antes de operar en la plataforma.</p></details>
  </section>
</body>
</html>`;
}

// /servicio/:oficio/:localidad — nodo principal del grafo
router.get('/:oficio/:localidad', (req, res) => {
  const { oficio, localidad } = req.params;
  const meta = RUBROS[oficio];
  const zona = LOCALIDADES[localidad];
  if (!meta || !zona) return res.status(404).send('Servicio o localidad no encontrados');
  const _seoEnriched = enrichSEOEvent({ localidad, oficio, intentType: 'service_search', req });
  trackEvent('SEO_SERVICE_VIEWED', { ..._seoEnriched, slug: oficio+'/'+localidad, actorRole: 'visitante', meta: { zona, categoria: meta.categoria } });
  const jsonLd = buildJsonLd(oficio, localidad, meta, zona);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildHtml(oficio, localidad, meta, zona, jsonLd));
});

// /servicio/:oficio — índice de zonas para el rubro
router.get('/:oficio', (req, res) => {
  const meta = RUBROS[req.params.oficio];
  if (!meta) return res.status(404).send('Servicio no encontrado');
  const links = Object.entries(LOCALIDADES)
    .map(([slug, label]) => `<li><a href="/servicio/${req.params.oficio}/${slug}">${meta.label} en ${label}</a></li>`)
    .join('\n');
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${meta.label} — ServiRed</title></head><body><h1>${meta.label}</h1><ul>${links}</ul></body></html>`);
});


// ── Red Económica AMBA — nodo institucional ────────────────────
router.get('/red-economica-amba', (req, res) => {
  const _netEnriched = enrichSEOEvent({ intentType: 'network_explore', req });
  trackEvent('ECONOMIC_NETWORK_VIEWED', { ..._netEnriched, actorRole: 'visitante', meta: { source: 'seo' } });
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://servired.online#organization",
        "name": "ServiRed",
        "alternateName": "ServiRed OS",
        "url": "https://servired.online",
        "description": "Infraestructura digital territorial que organiza y conecta la econom\u00eda real del AMBA: comercios, trabajadores verificados, PyMEs, fabricantes y distribuidores.",
        "knowsAbout": ["servicios profesionales", "comercios locales", "PyMEs argentinas", "fabricantes argentinos", "mantenimiento edilicio", "econom\u00eda territorial", "infraestructura econ\u00f3mica digital", "red econ\u00f3mica inteligente"],
        "areaServed": { "@type": "AdministrativeArea", "name": "AMBA - \u00c1rea Metropolitana de Buenos Aires" },
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Red Econ\u00f3mica ServiRed",
          "itemListElement": [
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Servicios profesionales para hogares" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Servicios para comercios y PyMEs" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Mantenimiento edilicio para edificios y consorcios" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Conectividad para fabricantes y distribuidores argentinos" } }
          ]
        }
      },
      {
        "@type": "WebPage",
        "url": "https://servired.online/red-economica-amba",
        "name": "ServiRed — La red econ\u00f3mica inteligente del AMBA",
        "description": "La infraestructura digital que organiza y conecta la econom\u00eda real argentina: fabricantes, distribuidores, comercios, profesionales y clientes en una sola red territorial."
      }
    ]
  };
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>ServiRed — La red econ\u00f3mica inteligente del AMBA</title>
  <meta name="description" content="ServiRed organiza y conecta la econom\u00eda real del AMBA: comercios, trabajadores verificados, PyMEs, fabricantes y distribuidores en una infraestructura digital territorial.">
  <link rel="canonical" href="https://servired.online/red-economica-amba">
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:2rem 1rem;color:#1a1a1a}
    h1{font-size:2rem;margin-bottom:1rem;color:#1a1a1a}
    h2{font-size:1.3rem;margin:2rem 0 .75rem;color:#333}
    p{line-height:1.7;color:#444;margin-bottom:1rem}
    .cta{display:inline-block;margin:1rem 0 2rem;padding:.75rem 1.5rem;background:#e63946;color:#fff;border-radius:8px;text-decoration:none;font-weight:700}
    .cadena{background:#f8f8f8;border-left:4px solid #e63946;padding:1.5rem;border-radius:0 8px 8px 0;margin:1.5rem 0}
    .cadena p{margin:0;font-size:1.1rem;line-height:2.2;color:#222}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1.5rem 0}
    .card{border:1px solid #e8e8e8;border-radius:8px;padding:1rem}
    .card h3{font-size:1rem;margin-bottom:.5rem;color:#e63946}
    .card p{font-size:.9rem;color:#555;margin:0}
  </style>
</head>
<body>
  <nav style="font-size:.85rem;color:#666;margin-bottom:1.5rem"><a href="/" style="color:#e63946;text-decoration:none">ServiRed</a> › Red Econ\u00f3mica AMBA</nav>
  <h1>ServiRed — La red econ\u00f3mica inteligente del AMBA</h1>
  <p>Miles de comercios, profesionales, PyMEs y fabricantes trabajan todos los d\u00edas en nuestra regi\u00f3n. El problema no es que falte oferta: falta conexi\u00f3n.</p>
  <p>ServiRed crea la infraestructura digital donde cada comercio puede ser encontrado, cada profesional puede demostrar su capacidad y cada PyME puede llegar a nuevos compradores. Una red donde la econom\u00eda real se vuelve visible, organizada y confiable.</p>
  <a class="cta" href="/">Ingresar a ServiRed</a>
  <h2>La cadena econ\u00f3mica del AMBA conectada</h2>
  <div class="cadena">
    <p>\ud83c\udfed Fabricante argentino<br>\u2193<br>\ud83d\udce6 Distribuidor / Corral\u00f3n<br>\u2193<br>\ud83c\udfe2 Comercio local<br>\u2193<br>\ud83d\udc77 Profesional verificado<br>\u2193<br>\ud83c\udfe0 Cliente final</p>
  </div>
  <h2>Cuatro capas de la red econ\u00f3mica ServiRed</h2>
  <div class="grid">
    <div class="card"><h3>\ud83c\udfe0 Servicios para hogares</h3><p>Electricistas, plomeros, gasistas, impermeabilizaci\u00f3n, c\u00e1maras de seguridad y 30 rubros m\u00e1s en todo el AMBA.</p></div>
    <div class="card"><h3>\ud83c\udfe2 Red de comercios</h3><p>Comercios y PyMEs locales conectados con proveedores, trabajadores y clientes de la zona.</p></div>
    <div class="card"><h3>\ud83c\udfd7\ufe0f Edificios y consorcios</h3><p>Proveedores verificados para mantenimiento edilicio recurrente: electricidad, impermeabilizaci\u00f3n, c\u00e1maras y m\u00e1s.</p></div>
    <div class="card"><h3>\ud83c\udfed Fabricantes y PyMEs</h3><p>La cadena productiva argentina conectada con la demanda real del AMBA y de todo el pa\u00eds.</p></div>
  </div>
  <h2>Zonas activas en el AMBA</h2>
  <p>Palermo &middot; Belgrano &middot; N\u00fa\u00f1ez &middot; Recoleta &middot; Caballito &middot; San Isidro &middot; Vicente L\u00f3pez &middot; Olivos &middot; Mart\u00ednez &middot; La Matanza &middot; Lomas de Zamora &middot; Quilmes y m\u00e1s zonas del AMBA.</p>
  <p><a href="/servicio/electricista/palermo" style="color:#e63946">Ver servicios en Palermo</a> &middot; <a href="/fabricantes-argentinos" style="color:#e63946">Red de fabricantes</a> &middot; <a href="/comercios/belgrano" style="color:#e63946">Comercios en Belgrano</a></p>
</body>
</html>`);
});

// ── Zona económica — datos reales desde ZoneMetrics ───────────
const ZoneMetrics = (() => { try { return require('../../models/ZoneMetrics'); } catch(e) { return null; } })();
const ZoneState   = (() => { try { return require('../../models/ZoneState'); } catch(e) { return null; } })();

router.get('/zona/:zona', async (req, res) => {
  const zonaSlug = req.params.zona;
  const zonaLabel = LOCALIDADES[zonaSlug] || zonaSlug.replace(/_/g,'-');
  const _zoneEnriched = enrichSEOEvent({ localidad: zonaSlug, intentType: 'zone_browse', req });
  trackEvent('ZONE_PAGE_VIEWED', { ..._zoneEnriched, actorRole: 'visitante', meta: { zona: zonaLabel } });

  let metrics = null;
  let zoneState = null;
  try {
    if (ZoneMetrics) metrics = await ZoneMetrics.findOne({ zoneId: zonaSlug }).lean();
    if (ZoneState)   zoneState = await ZoneState.findOne({ zoneId: zonaSlug }).lean();
  } catch(e) { /* sin datos — mostrar estructura */ }

  const workers   = metrics?.workersActivos   ?? '—';
  const commerces = metrics?.commercesActivos ?? '—';
  const pedidos   = metrics?.pedidosUltimas24h ?? '—';
  const pressure  = zoneState?.zoneState ?? 'SIN DATOS';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    "name": zonaLabel,
    "containedInPlace": { "@type": "AdministrativeArea", "name": "AMBA" },
    "description": `Estado de la red econ\u00f3mica ServiRed en ${zonaLabel}. Comercios, trabajadores verificados y PyMEs conectados.`
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Red econ\u00f3mica ServiRed en ${zonaLabel}</title>
  <meta name="description" content="Estado de la red ServiRed en ${zonaLabel}: comercios activos, trabajadores verificados, PyMEs y rubros disponibles.">
  <link rel="canonical" href="https://servired.online/zona/${zonaSlug}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>body{font-family:'Segoe UI',sans-serif;max-width:760px;margin:0 auto;padding:2rem 1rem;color:#1a1a1a} h1{font-size:1.8rem;margin-bottom:.75rem} .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin:1.5rem 0} .kpi{border:1px solid #e8e8e8;border-radius:8px;padding:1rem;text-align:center} .kpi-val{font-size:2rem;font-weight:700;color:#e63946} .kpi-lbl{font-size:.8rem;color:#888;text-transform:uppercase;letter-spacing:1px} .badge{display:inline-block;padding:.3rem .8rem;border-radius:20px;font-size:.8rem;font-weight:700;background:#f0f0f0;color:#333;margin:.5rem 0}</style>
</head>
<body>
  <nav style="font-size:.85rem;color:#666;margin-bottom:1rem"><a href="/" style="color:#e63946;text-decoration:none">ServiRed</a> › <a href="/red-economica-amba" style="color:#e63946">Red AMBA</a> › ${zonaLabel}</nav>
  <h1>Red econ\u00f3mica ServiRed en ${zonaLabel}</h1>
  <p>Estado actual de la red ServiRed en ${zonaLabel}: comercios verificados, trabajadores disponibles y actividad econ\u00f3mica del territorio.</p>
  <span class="badge">Estado: ${pressure}</span>
  <div class="grid">
    <div class="kpi"><div class="kpi-val">${workers}</div><div class="kpi-lbl">Trabajadores</div></div>
    <div class="kpi"><div class="kpi-val">${commerces}</div><div class="kpi-lbl">Comercios</div></div>
    <div class="kpi"><div class="kpi-val">${pedidos}</div><div class="kpi-lbl">Pedidos 24h</div></div>
    <div class="kpi"><div class="kpi-val">${Object.keys(RUBROS).length}</div><div class="kpi-lbl">Rubros</div></div>
  </div>
  <h2>Servicios disponibles en ${zonaLabel}</h2>
  <ul>${Object.entries(RUBROS).slice(0,12).map(([k,v])=>`<li><a href="/servicio/${k}/${zonaSlug}" style="color:#e63946">${v.label}</a></li>`).join('')}</ul>
  <p style="margin-top:1rem"><a href="/red-economica-amba" style="color:#e63946">Ver toda la red econ\u00f3mica AMBA</a></p>
</body>
</html>`);
});

module.exports = router;

// ── Capa 2: Edificios y consorcios ─────────────────────────────
const BARRIOS_PREMIUM = {
  palermo:'Palermo', belgrano:'Belgrano', nunez:'Núñez',
  recoleta:'Recoleta', caballito:'Caballito', retiro:'Retiro',
  puerto_madero:'Puerto Madero', san_isidro:'San Isidro',
  vicente_lopez:'Vicente López', olivos:'Olivos', martinez:'Martínez'
};

router.get('/edificios/:barrio', (req, res) => {
  const zona = BARRIOS_PREMIUM[req.params.barrio];
  if (!zona) return res.status(404).send('No encontrado');
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Mantenimiento de Edificios en ${zona} — ServiRed</title>
<meta name="description" content="ServiRed conecta administraciones de edificios en ${zona} con proveedores verificados: electricidad, impermeabilización, cámaras, limpieza y más.">
<link rel="canonical" href="https://servired.online/edificios/${req.params.barrio}">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Service","name":"Mantenimiento Edilicio en "+zona,"provider":{"@type":"Organization","name":"ServiRed","url":"https://servired.online"},"areaServed":{"@type":"City","name":zona},"description":"Servicios de mantenimiento para edificios y consorcios en "+zona+". Electricidad, impermeabilización, cámaras de seguridad, limpieza y más.","serviceType":"Mantenimiento Edilicio"})}</script>
</head><body>
<h1>Mantenimiento de Edificios en ${zona}</h1>
<p>ServiRed conecta administraciones de consorcios y edificios en ${zona} con proveedores verificados para mantenimiento integral.</p>
<ul>
<li>Electricidad general y emergencias</li>
<li>Impermeabilización de terrazas y azoteas</li>
<li>Cámaras de seguridad y alarmas</li>
<li>Limpieza comercial y de espacios comunes</li>
<li>Plomería y desagües</li>
<li>Pintura de consorcios</li>
<li>Porteros eléctricos y video porteros</li>
</ul>
<p><a href="https://servired.online">Solicitar servicio en ${zona}</a></p>
</body></html>`);
});

// ── Capa 3: Comercios y PyMEs por zona ─────────────────────────
router.get('/comercios/:zona', (req, res) => {
  const zona = BARRIOS_PREMIUM[req.params.zona] || req.params.zona.replace(/-/g,' ');
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Servicios para Comercios y PyMEs en ${zona} — ServiRed</title>
<meta name="description" content="ServiRed conecta comercios y PyMEs en ${zona} con proveedores, trabajadores y servicios profesionales verificados.">
<link rel="canonical" href="https://servired.online/comercios/${req.params.zona}">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Service","name":"Servicios para Comercios en "+zona,"provider":{"@type":"Organization","name":"ServiRed","url":"https://servired.online"},"areaServed":{"@type":"City","name":zona},"description":"ServiRed conecta comercios y PyMEs en "+zona+" con trabajadores verificados, proveedores y servicios profesionales.","serviceType":"Servicios Comerciales"})}</script>
</head><body>
<h1>Servicios para Comercios y PyMEs en ${zona}</h1>
<p>ServiRed es la red económica que conecta negocios, comercios y PyMEs en ${zona} con trabajadores verificados y proveedores confiables.</p>
<ul>
<li>Instalaciones eléctricas comerciales</li>
<li>Cámaras de seguridad para comercios</li>
<li>Mantenimiento de locales</li>
<li>Limpieza comercial</li>
<li>Redes y tecnología</li>
<li>Refrigeración y climatización</li>
<li>Proveedores de materiales</li>
</ul>
<p><a href="https://servired.online">Registrar mi comercio en ServiRed</a></p>
</body></html>`);
});

// ── Capa 4: Fabricantes y PyMEs Argentina ──────────────────────
const FABRICANTES = {
  muebles:      { label:'Fabricantes de Muebles',       desc:'Muebles a medida, amoblamiento, carpintería industrial' },
  aberturas:    { label:'Fabricantes de Aberturas',      desc:'Ventanas, puertas, perfiles de aluminio y PVC' },
  metalurgicas: { label:'PyMEs Metalúrgicas',            desc:'Estructuras metálicas, herrería, soldadura industrial' },
  materiales:   { label:'Distribuidores de Materiales',  desc:'Corralones, ferreterías, materiales de construcción' },
  seguridad:    { label:'Fabricantes de Seguridad',      desc:'Cámaras, alarmas, control de acceso' },
  solares:      { label:'Proveedores de Energía Solar',  desc:'Paneles solares, inversores, instalaciones' },
  textiles:     { label:'PyMEs Textiles',                desc:'Indumentaria, uniformes, ropa de trabajo' },
  alimentos:    { label:'PyMEs Alimenticias',            desc:'Alimentos, bebidas, distribución gastronómica' },
};

router.get('/fabricantes-argentinos', (req, res) => {
  const items = Object.entries(FABRICANTES).map(([k,v]) =>
    `<li><a href="/fabricantes-argentinos/${k}">${v.label}</a> — ${v.desc}</li>`).join('');
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Fabricantes y PyMEs Argentinas — ServiRed</title>
<meta name="description" content="ServiRed conecta fabricantes, distribuidores y PyMEs argentinas con compradores, comercios y profesionales de todo el AMBA.">
<link rel="canonical" href="https://servired.online/fabricantes-argentinos">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Organization","name":"ServiRed — Red de Fabricantes Argentinos","url":"https://servired.online/fabricantes-argentinos","description":"ServiRed conecta fabricantes y PyMEs argentinas con compradores profesionales, comercios y distribuidores del AMBA."})}</script>
</head><body>
<h1>Fabricantes y PyMEs Argentinas en ServiRed</h1>
<p>ServiRed es la red económica territorial que conecta fabricantes argentinos con compradores, comercios y profesionales del AMBA y todo el país.</p>
<ul>${items}</ul>
<p><a href="https://servired.online">Registrar mi PyME o fábrica en ServiRed</a></p>
</body></html>`);
});

router.get('/fabricantes-argentinos/:categoria', (req, res) => {
  const cat = FABRICANTES[req.params.categoria];
  if (!cat) return res.status(404).send('No encontrado');
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>${cat.label} en Argentina — ServiRed</title>
<meta name="description" content="${cat.label} conectados en ServiRed. ${cat.desc}. Encontrá proveedores verificados en el AMBA.">
<link rel="canonical" href="https://servired.online/fabricantes-argentinos/${req.params.categoria}">
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Service","name":cat.label+" — ServiRed","description":cat.desc,"provider":{"@type":"Organization","name":"ServiRed"},"areaServed":{"@type":"Country","name":"Argentina"}})}</script>
</head><body>
<h1>${cat.label} en Argentina</h1>
<p>${cat.desc}. ServiRed conecta fabricantes y PyMEs argentinas con compradores profesionales, comercios y distribuidores.</p>
<p><a href="https://servired.online">Registrar mi empresa en ServiRed</a></p>
</body></html>`);
});
