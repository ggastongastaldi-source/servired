'use strict';

const express = require('express');
const router = express.Router();
const { generarCaso } = require('../seo/casoBuilder');
const { parsearSlug } = require('../seo/slugBuilder');
const { renderHtml } = require('../seo/htmlBuilder');

router.get('/:slug', (req, res) => {
  const { slug } = req.params;

  const partes = parsearSlug(slug);
  if (!partes) {
    return res.status(404).send('<h1>404 — Página no encontrada</h1>');
  }

  let caso;
  try {
    caso = generarCaso({ oficio: partes.oficio, localidad: partes.localidad });
  } catch (err) {
    return res.status(500).send('<h1>Error interno</h1>');
  }

  const html = renderHtml({
    meta: caso.meta,
    faqs: caso.faqs,
    jsonld: caso.jsonld,
    oficio: caso.oficio,
    localidad: caso.localidad,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

module.exports = router;
