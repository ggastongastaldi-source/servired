'use strict';

const BASE_URL = process.env.BASE_URL || 'https://servired.online';

function generarJSONLD({ oficio, localidad, slug, precio, faqs = [] }) {
  const nombre = `${capitalizar(oficio)} en ${capitalizar(localidad)}`;
  const url = `${BASE_URL}/casos/${slug}`;

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `ServiRed — ${nombre}`,
    description: `Encontrá ${oficio}s confiables en ${localidad}. Presupuesto inmediato, pago seguro.`,
    url,
    areaServed: { '@type': 'City', name: localidad },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: capitalizar(oficio),
      itemListElement: [{
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: nombre },
        ...(precio ? { priceSpecification: { '@type': 'PriceSpecification', price: precio, priceCurrency: 'ARS' } } : {}),
      }],
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: capitalizar(oficio), item: `${BASE_URL}/servicios/${encodeURIComponent(oficio)}` },
      { '@type': 'ListItem', position: 3, name: `${capitalizar(oficio)} en ${capitalizar(localidad)}`, item: url },
    ],
  };

  const result = [localBusiness, breadcrumb];

  if (faqs.length > 0) {
    result.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(({ pregunta, respuesta }) => ({
        '@type': 'Question',
        name: pregunta,
        acceptedAnswer: { '@type': 'Answer', text: respuesta },
      })),
    });
  }

  return result;
}

function capitalizar(texto) {
  return texto.replace(/(?:^|\s)\S/g, l => l.toUpperCase());
}

module.exports = { generarJSONLD };
