/**
 * seo.js — AEO (Answer Engine Optimization)
 * Rutas /servicio/:oficio/:localidad con JSON-LD Schema.org
 * Para indexación por LLMs: ChatGPT, Perplexity, Claude, etc.
 */
'use strict';

const express = require('express');
const router  = express.Router();

const RUBROS = {
  electricista:       { label: 'Electricista',       categoria: 'Servicios Eléctricos' },
  plomero:            { label: 'Plomero',             categoria: 'Servicios de Plomería' },
  gasista:            { label: 'Gasista',             categoria: 'Servicios de Gas' },
  pintor:             { label: 'Pintor',              categoria: 'Servicios de Pintura' },
  albanil:            { label: 'Albañil',             categoria: 'Construcción y Reformas' },
  carpintero:         { label: 'Carpintero',          categoria: 'Carpintería' },
  cerrajero:          { label: 'Cerrajero',           categoria: 'Cerrajería' },
  limpieza_hogar:     { label: 'Limpieza del Hogar',  categoria: 'Limpieza' },
  servicio_domestico: { label: 'Servicio Doméstico',  categoria: 'Servicio Doméstico' },
  aire_acondicionado: { label: 'Técnico A/C',         categoria: 'Climatización' },
  fletes:             { label: 'Flete',               categoria: 'Mudanzas y Fletes' },
  jardinero:          { label: 'Jardinero',           categoria: 'Jardinería' },
};

const LOCALIDADES = {
  la_matanza:             'La Matanza',
  lomas_de_zamora:        'Lomas de Zamora',
  quilmes:                'Quilmes',
  moreno:                 'Moreno',
  merlo:                  'Merlo',
  tigre:                  'Tigre',
  san_isidro:             'San Isidro',
  tres_de_febrero:        'Tres de Febrero',
  moron:                  'Morón',
  avellaneda:             'Avellaneda',
  lanus:                  'Lanús',
  florencio_varela:       'Florencio Varela',
  isidro_casanova:        'Isidro Casanova',
  ciudad_de_buenos_aires: 'Ciudad de Buenos Aires',
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
