'use strict';

const NORMALIZATIONS = [
  [/á/g, 'a'], [/é/g, 'e'], [/í/g, 'i'], [/ó/g, 'o'], [/ú/g, 'u'],
  [/ü/g, 'u'], [/ñ/g, 'n'],
  [/Á/g, 'a'], [/É/g, 'e'], [/Í/g, 'i'], [/Ó/g, 'o'], [/Ú/g, 'u'],
  [/Ü/g, 'u'], [/Ñ/g, 'n'],
];

function normalizarTexto(texto) {
  let result = texto.toLowerCase().trim();
  for (const [pattern, replacement] of NORMALIZATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function generarSlug(oficio, localidad) {
  if (!oficio || !localidad) throw new Error('generarSlug: oficio y localidad son requeridos');
  return `${normalizarTexto(oficio)}-en-${normalizarTexto(localidad)}`;
}

function parsearSlug(slug) {
  if (!slug || !slug.includes('-en-')) return null;
  const idx = slug.indexOf('-en-');
  return {
    oficio: slug.substring(0, idx).replace(/-/g, ' '),
    localidad: slug.substring(idx + 4).replace(/-/g, ' '),
  };
}

module.exports = { generarSlug, parsearSlug, normalizarTexto };
