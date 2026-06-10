'use strict';

const express = require('express');
const router = express.Router();
const { generarCaso } = require('../seo/casoBuilder');
const { parsearSlug } = require('../seo/slugBuilder');

const BASE_URL = process.env.BASE_URL || 'https://servired.online';

router.get('/:slug', (req, res) => {
  const { slug } = req.params;

  const partes = parsearSlug(slug);
  if (!partes) {
    return res.status(404).json({ error: 'Slug inválido', slug });
  }

  let caso;
  try {
    caso = generarCaso({ oficio: partes.oficio, localidad: partes.localidad });
  } catch (err) {
    return res.status(500).json({ error: 'Error generando caso', detalle: err.message });
  }

  // Respuesta JSON para smoke test. HTML completo se agrega en Fase 2.
  return res.json({
    slug: caso.slug,
    oficio: caso.oficio,
    localidad: caso.localidad,
    meta: caso.meta,
    faqs: caso.faqs,
    jsonld: caso.jsonld,
  });
});

module.exports = router;
