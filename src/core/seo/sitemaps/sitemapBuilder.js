'use strict';

const BASE_URL = process.env.BASE_URL || 'https://www.servired.online';

const OFICIOS = [
  'electricista','plomero','gasista','cerrajero','pintor',
  'carpintero','albanil','herrero','techista','soldador',
  'fumigador','jardinero',
];

const LOCALIDADES = [
  'la-matanza','lomas-de-zamora','quilmes','moreno','merlo',
  'tigre','san-isidro','moron','avellaneda','lanus',
  'florencio-varela','isidro-casanova','ciudad-de-buenos-aires',
  'ramos-mejia',
];

const LOCALIDADES_SERVICIO = [
  'la_matanza','lomas_de_zamora','quilmes','moreno','merlo',
  'tigre','san_isidro','moron','avellaneda','lanus',
  'florencio_varela','isidro_casanova','ciudad_de_buenos_aires',
  'ramos_mejia',
];

function urlTag(loc, priority = '0.8', changefreq = 'weekly') {
  return `  <url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function wrapUrlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function wrapSitemapIndex(sitemaps) {
  const entries = sitemaps.map(({ loc, lastmod }) =>
    `  <sitemap><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</sitemap>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

function generarSitemapIndex() {
  const hoy = new Date().toISOString().split('T')[0];
  return wrapSitemapIndex([
    { loc: `${BASE_URL}/sitemap-static.xml`,   lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-servicios.xml`, lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-casos.xml`,     lastmod: hoy },
  ]);
}

function generarSitemapStatic() {
  return wrapUrlset([
    urlTag(`${BASE_URL}/`, '1.0', 'daily'),
  ]);
}

function generarSitemapServicios() {
  const urls = [];
  for (const oficio of OFICIOS) {
    for (const loc of LOCALIDADES_SERVICIO) {
      urls.push(urlTag(`${BASE_URL}/servicio/${oficio}/${loc}`, '0.9'));
    }
  }
  return wrapUrlset(urls);
}

function generarSitemapCasos() {
  const urls = [];
  for (const oficio of OFICIOS) {
    for (const loc of LOCALIDADES) {
      urls.push(urlTag(`${BASE_URL}/casos/${oficio}-en-${loc}`, '0.8'));
    }
  }
  return wrapUrlset(urls);
}

module.exports = {
  generarSitemapIndex,
  generarSitemapStatic,
  generarSitemapServicios,
  generarSitemapCasos,
};
