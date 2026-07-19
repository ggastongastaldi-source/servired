/**
 * seo.js — AEO (Answer Engine Optimization)
 * Rutas /servicio/:oficio/:localidad con JSON-LD Schema.org
 * Para indexación por LLMs: ChatGPT, Perplexity, Claude, etc.
 */
'use strict';

const express = require('express');
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

const LOCALIDADES = {
  // AMBA sur/oeste (origen)
  la_matanza:             'La Matanza',
  lomas_de_zamora:        'Lomas de Zamora',
  quilmes:                'Quilmes',
  moreno:                 'Moreno',
  merlo:                  'Merlo',
  tres_de_febrero:        'Tres de Febrero',
  moron:                  'Morón',
  avellaneda:             'Avellaneda',
  lanus:                  'Lanús',
  florencio_varela:       'Florencio Varela',
  isidro_casanova:        'Isidro Casanova',
  // Corredor norte — alto poder adquisitivo
  san_isidro:             'San Isidro',
  vicente_lopez:          'Vicente López',
  olivos:                 'Olivos',
  la_lucila:              'La Lucila',
  martinez:               'Martínez',
  acassuso:               'Acassuso',
  tigre:                  'Tigre',
  nordelta:               'Nordelta',
  // CABA — barrios premium
  palermo:                'Palermo',
  belgrano:               'Belgrano',
  nunez:                  'Núñez',
  recoleta:               'Recoleta',
  caballito:              'Caballito',
  retiro:                 'Retiro',
  puerto_madero:          'Puerto Madero',
  las_canitas:            'Las Cañitas',
  colegiales:             'Colegiales',
  villa_urquiza:          'Villa Urquiza',
  saavedra:               'Saavedra',
  coghlan:                'Coghlan',
  flores:                 'Flores',
  almagro:                'Almagro',
  villa_crespo:           'Villa Crespo',
  // General
  ciudad_de_buenos_aires: 'Ciudad de Buenos Aires',
  gran_buenos_aires:      'Gran Buenos Aires',
};

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
          "description": "Plataforma de servicios del hogar para el AMBA. Conectamos clientes con trabajadores verificados.",
          "areaServed": "Gran Buenos Aires"
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
  <h1>${meta.label} en ${zona}</h1>
  <p>Encontrá ${meta.label.toLowerCase()}s verificados en ${zona} de forma rápida y segura. ServiRed conecta tu solicitud con el trabajador disponible más cercano en tiempo real.</p>
  <a class="cta" href="/?rubro=${rubro}&zona=${localidad}">Solicitar ${meta.label} ahora</a>
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
