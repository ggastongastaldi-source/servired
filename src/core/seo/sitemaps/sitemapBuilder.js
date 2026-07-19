'use strict';

const BASE_URL = process.env.BASE_URL || 'https://www.servired.online';

const RUBROS = [
  'electricista','plomero','gasista','pintor','albanil','carpintero',
  'cerrajero','limpieza_hogar','servicio_domestico','aire_acondicionado',
  'fletes','jardinero','camaras_seguridad','paneles_solares','redes_wifi',
  'alarmas','porteros_electricos','tecnico_pc','impermeabilizacion',
  'durlock','pisos_revestimientos','techista','soldador','herreria',
  'servicio_pyme','servicio_comercio','mantenimiento_edilicio',
  'limpieza_comercial','fabricante_muebles','fabricante_aberturas',
  'distribuidor_materiales','corralon',
];

const LOCALIDADES = [
  'la_matanza','lomas_de_zamora','quilmes','moreno','merlo',
  'tres_de_febrero','moron','avellaneda','lanus','florencio_varela',
  'isidro_casanova','san_isidro','vicente_lopez','olivos','la_lucila',
  'martinez','acassuso','tigre','nordelta','palermo','belgrano','nunez',
  'recoleta','caballito','retiro','puerto_madero','las_canitas',
  'colegiales','villa_urquiza','saavedra','coghlan','flores','almagro',
  'villa_crespo','ciudad_de_buenos_aires','gran_buenos_aires',
];

const BARRIOS_PREMIUM = [
  'palermo','belgrano','nunez','recoleta','caballito','retiro',
  'puerto_madero','san_isidro','vicente_lopez','olivos','martinez',
];

const FABRICANTES_CATS = [
  'muebles','aberturas','metalurgicas','materiales',
  'seguridad','solares','textiles','alimentos',
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
    { loc: `${BASE_URL}/sitemap-static.xml`,      lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-servicios.xml`,   lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-casos.xml`,        lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-edificios.xml`,    lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-comercios.xml`,    lastmod: hoy },
    { loc: `${BASE_URL}/sitemap-fabricantes.xml`,  lastmod: hoy },
  ]);
}

function generarSitemapStatic() {
  return wrapUrlset([
    urlTag(`${BASE_URL}/`, '1.0', 'daily'),
    urlTag(`${BASE_URL}/fabricantes-argentinos`, '0.9', 'weekly'),
  ]);
}

function generarSitemapServicios() {
  const urls = [];
  for (const rubro of RUBROS) {
    for (const loc of LOCALIDADES) {
      urls.push(urlTag(`${BASE_URL}/servicio/${rubro}/${loc}`, '0.9'));
    }
  }
  return wrapUrlset(urls);
}

function generarSitemapCasos() {
  const urls = [];
  for (const rubro of RUBROS) {
    for (const loc of LOCALIDADES) {
      const slug = loc.replace(/_/g, '-');
      urls.push(urlTag(`${BASE_URL}/casos/${rubro}-en-${slug}`, '0.8'));
    }
  }
  return wrapUrlset(urls);
}

function generarSitemapEdificios() {
  const urls = BARRIOS_PREMIUM.map(b =>
    urlTag(`${BASE_URL}/edificios/${b}`, '0.85', 'monthly')
  );
  return wrapUrlset(urls);
}

function generarSitemapComercios() {
  const urls = LOCALIDADES.map(l =>
    urlTag(`${BASE_URL}/comercios/${l}`, '0.85', 'monthly')
  );
  return wrapUrlset(urls);
}

function generarSitemapFabricantes() {
  const urls = [
    urlTag(`${BASE_URL}/fabricantes-argentinos`, '0.9', 'weekly'),
    ...FABRICANTES_CATS.map(c =>
      urlTag(`${BASE_URL}/fabricantes-argentinos/${c}`, '0.85', 'monthly')
    ),
  ];
  return wrapUrlset(urls);
}

module.exports = {
  generarSitemapIndex,
  generarSitemapStatic,
  generarSitemapServicios,
  generarSitemapCasos,
  generarSitemapEdificios,
  generarSitemapComercios,
  generarSitemapFabricantes,
};
